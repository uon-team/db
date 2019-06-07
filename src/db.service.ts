
import { Injectable, Inject, Injector, Provider, Type } from '@uon/core';
import { DB_MODULE_CONFIG, DbModuleConfig, DbCollectionDefinition } from './db.config';
import { DbContext, CreateModelDefinition } from './db.context';
import { MongoClient, IndexOptions } from 'mongodb';
import { IndexDefinition } from './mongo/index.interface';
import { DbHook } from './db.hooks';
import { ModelDefinition } from './db.interfaces';
import { Model, FindModelAnnotation, GetModelMembers, JsonSerializer } from '@uon/model';



@Injectable()
export class DbService {

    private _activeConnections: { [k: string]: MongoClient } = {};
    private _modelDefCacheByDbName: { [k: string]: Map<Type<any>, ModelDefinition<any>> } = {};

    constructor(@Inject(DB_MODULE_CONFIG) private _config: DbModuleConfig,
        private _injector: Injector
    ) {
        // initialize
        this.initModelDefs();
    }


    /**
     * Creates a db request context, upon which db queries can be made
     */
    async createContext(dbName: string, hooks: DbHook[], injector?: Injector) {

        // fetch client
        const client = await this.getClientByName(dbName);
        const db_def = this._config.databases.find(d => d.name === dbName);

        if (!db_def) {
            throw new Error(`DbConnectionConfig with name ${dbName} not found. 
            Did you mean one of [${this._config.databases.map(d => d.name)}]?`);
        }

        // generate model/collection definitions
        const collections = this._modelDefCacheByDbName[dbName];

        // create context
        const context = new DbContext({
            client,
            collections,
            injector: injector || this._injector,
            hooks
        });

        return context;

    }


    /**
     * Destroy a context
     */
    async destroyContext(context: DbContext) {


        // flush any pending transactions


    }

    /**
     * 
     * @param dbName 
     */
    async syncIndices(dbName: string) {

        const db_def = this.findDbOrThrow(dbName);

        // connect to db
        const client = new MongoClient(db_def.url, { useNewUrlParser: true });
        await client.connect();

        // grab db
        const db = client.db();

        // iterate over all defined collection for this db
        for (let i = 0; i < db_def.collections.length; ++i) {

            const col_def = db_def.collections[i];

            // might not have any indices
            if (!col_def.indices) {
                continue;
            }

            console.log(`Syncing indices for ${col_def.name}`);

            await db.createCollection(col_def.name);


            // grab the collection 
            const collection = db.collection(col_def.name);

            // grab existing indices
            const indexes: any[] = await collection.indexes();


            // go over each index definition
            for (let j = 0, l = col_def.indices.length; j < l; ++j) {

                const index = col_def.indices[j];

                console.log(`\tIndex: ${index.name}`);

                // check if the index was previously defined, and if it changed
                // if so, we need to drop the old index and create a new one
                const prev_index = indexes.find(idx => idx.name === index.name);

                if (prev_index) {

                    if (!CompareIndex(index, prev_index)) {
                        // drop index
                        console.log(`\t Dropping...`);
                        await collection.dropIndex(index.name);

                    }
                    // the index is the same, there is nothing to do
                    else {
                        console.log(`\t No Changes...`);
                        continue;
                    }
                }

                const fields = index.fields;
                const ops = Object.assign({}, index);
                delete ops.fields;

                // create the index
                console.log(`\t Creating...`);
                await collection.createIndex(fields, ops);
            }

            //client.

            //await client.close();

        }




    }

    private findDbOrThrow(name: string) {

        const def = this._config.databases.find(d => d.name === name);

        if (!def) {
            throw new Error(`No database connection with name "${name}" was defined in config.`)
        }

        return def;
    }

    private async getClientByName(name: string) {


        if (this._activeConnections[name]) {
            return this._activeConnections[name];
        }

        const def = this.findDbOrThrow(name);

        const client = new MongoClient(def.url, { useNewUrlParser: true, ...def.options });
        await client.connect();

        this._activeConnections[name] = client;

        return client;

    }

    private initModelDefs() {


        const dbs = this._config.databases;

        for (let i = 0; i < dbs.length; ++i) {

            const db_def = this._config.databases[i];
            const colls = db_def.collections;
            const map = this._modelDefCacheByDbName[db_def.name] = new Map();

            for (let j = 0; j < colls.length; ++j) {

                const coll_def = colls[j];
                const def = CreateModelDefinition(coll_def.model, coll_def.name);
                map.set(coll_def.model, def);

            }

        }

    }
}




/**
 * Compares a defined Index with the one returned by mongo
 * @param a 
 * @param b 
 */
function CompareIndex(a: IndexDefinition<any>, b: any): boolean {

    for (let key in a.fields) {

        if (a.fields[key] === "text") {
            if (!b.key._fts)
                return false;
        }
        else if (!b.key[key]) {
            return false;
        }
        else if (b.key[key] != a.fields[key]) {
            return false;
        }

    }


    if (!!a.sparse !== !!b.sparse) {
        return false;
    }

    if (!!a.unique !== !!b.unique) {
        return false;
    }

    if (a.expireAfterSeconds != b.expireAfterSeconds) {
        return false;
    }

    return true;
}