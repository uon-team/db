
import { Injectable, Inject, Injector, Type } from '@uon/core';
import { DB_MODULE_CONFIG, DbModuleConfig, DbCollectionDefinition } from './db.config';
import { DbContext } from './db.context';
import { MongoClient } from 'mongodb';
import { IndexDefinition } from './mongo/index.interface';
import { DbHook } from './db.hooks';
import { GetDbSchema } from './db.metadata';


@Injectable()
export class DbService {

    private _activeConnections: { [k: string]: MongoClient } = {};

    constructor(@Inject(DB_MODULE_CONFIG) private _config: DbModuleConfig,
        private _injector: Injector
    ) { }


    /**
     * Creates a db request context, upon which db queries can be made
     * @param connectionName The connection name defined in DbModule.WithConfig
     * @param dbName The name of the mongo database
     * @param collections A list of collection definitions to use in this context
     * @param hooks A list of hooks 
     * @param injector An optional injector for instanciating hooks, the root injector will be used if not provided
     */
    async createContext(connectionName: string,
        dbName: string,
        hooks: DbHook[] = [],
        injector: Injector = this._injector) {

        // fetch client
        const client = await this.getClientByName(connectionName);

        // create context
        const context = new DbContext({
            client,
            dbName,
            injector,
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

    async disconnectAll() {

        const keys = Object.keys(this._activeConnections);

        for (let i = 0; i < keys.length; i++) {
            const conn = this._activeConnections[keys[i]];

            await conn.close(true);
            this._activeConnections[keys[i]] = null;
        }

    }

    /**
     * 
     * @param connectionName 
     * @param dbName 
     * @param collections 
     */
    async syncIndices(connectionName: string,
        dbName: string,
        models: Type<any>[]) {

        const conn_def = this.findConnectionOrThrow(connectionName);

        // connect to db
        const client = new MongoClient(conn_def.url, {
            family: 4
        });
        await client.connect();

        // grab db
        const db = client.db(dbName);

        // iterate over all defined collection for this db
        for (let i = 0; i < models.length; ++i) {

            const model = models[i];

            const col_def = GetDbSchema(model);

            // might not have any indices
            if (!col_def.indices) {
                continue;
            }

            console.log(`Syncing indices for ${col_def.collection}`);

            try {
                await db.createCollection(col_def.collection, {  });
                console.log(`Creating Collection ${col_def.collection}`);
            }
            catch(e) {
                
            }

            // grab the collection 
            const collection = db.collection(col_def.collection);

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

        }

        // close the connection
        await client.close();

    }

    private findConnectionOrThrow(name: string) {

        const def = this._config.connections.find(d => d.name === name);

        if (!def) {
            throw new Error(`No database connection with name "${name}" was defined in config.`)
        }

        return def;
    }

    private async getClientByName(name: string) {


        if (this._activeConnections[name]) {
            return this._activeConnections[name];
        }

        const def = this.findConnectionOrThrow(name);

        const client = new MongoClient(def.url, {
            family: 4,
            ...def.options
        });

        await client.connect();

        this._activeConnections[name] = client;

        return client;

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