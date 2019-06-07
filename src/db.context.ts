import { MongoClient, Db, ClientSession, ObjectId, UpdateOneOptions, UpdateManyOptions, CollectionInsertManyOptions, CollectionInsertOneOptions, CommonOptions, FindOneAndDeleteOption, CollectionAggregationOptions, MongoCountPreferences } from "mongodb";
import { Type, Injector, Provider } from "@uon/core";
import { ID, JsonSerializer, Model, FindModelAnnotation, GetModelMembers } from "@uon/model";
import { Query } from "./mongo/query.interface";
import { ModelDefinition } from "./db.interfaces";
import { Update } from "./mongo/update.interface";
import { AggregateQuery } from "./mongo/aggregate.interface";
import { DbCollectionDefinition } from "./db.config";
import { FindOneOptionsEx } from "./mongo/extensions.interface";
import { DbHook, CountHookParams, FindOneHookParams, FindHookParams, InsertOneHookParams, InsertManyHookParams, UpdateOneHookParams, UpdateManyHookParams, DeleteOneHookParams, DeleteManyHookParams, AggregateHookParams } from "./db.hooks";



const HOOK_METHODS = ['count', 'findOne', 'find', 'insertOne', 'insertMany', 'updateOne', 'updateMany', 'deleteOne', 'deleteMany', 'aggregate'];


export interface DbContextOptions {

    client: MongoClient;
    collections: Map<Type<any>, ModelDefinition<any>>;
    injector: Injector;
    hooks: DbHook[];

}


/**
 * 
 */
export class DbContext {

    private _client: MongoClient;
    private _db: Db;
    private _clientSession: ClientSession;
    private _hooksByMethod: { [k: string]: DbHook[] } = {};
    private _injector: Injector;

    constructor(private _options: DbContextOptions) {

        this._client = _options.client;
        this._db = this._client.db();

        const providers = [
            <Provider>{ token: DbContext, value: this }
        ].concat(this._options.hooks);

        this._injector = Injector.Create(providers, _options.injector);

        const hooks = _options.hooks;
        const list = this._hooksByMethod;

        for (let i = 0, l = hooks.length; i < l; ++i) {

            const hook = hooks[i];
            const proto = hook.prototype;

            for (let j = 0, jl = HOOK_METHODS.length; j < jl; ++j) {
                let name = HOOK_METHODS[j];

                if (proto[name]) {
                    list[name] = list[name] || [];
                    list[name].push(hook);
                }
            }

        }



    }

    /**
     * Access to mongo Db interface
     */
    get db() {
        return this._db;
    }



    /*
        startTransaction(options?: TransactionOptions) {
    
            if (!this._clientSession) {
                this._clientSession = this._client.startSession();
            }
    
            this._clientSession.startTransaction(options);
    
        }
    
        async commitTransaction() {
    
    
            if (!this._clientSession) {
                throw new Error(`No transaction to commit`);
            }
    
            await this._clientSession.commitTransaction();
    
            this._clientSession.endSession();
            this._clientSession = null;
    
        }
    
        async abortTransaction() {
    
            if (!this._clientSession) {
                throw new Error(`No transaction to commit`);
            }
    
            await this._clientSession.abortTransaction();
    
            this._clientSession.endSession();
            this._clientSession = null;
    
        }
    */


    /**
     * Count all documents matching the query
     * @param type 
     * @param query 
     * @param options 
     */
    async count<T>(type: Type<T>, query: Query<T>, options: MongoCountPreferences = {}) {

        const def = this.getOrCreateDefinition(type);
        const collection = this._db.collection(def.collName);
        this.formatOptions(options);

        const result = await collection.countDocuments(
            this.normalizeQuery(def, query),
            options
        );


        await this.invokeHooks('count', { def, query, options, result });

        return result;
    }

    /**
     * Fetch a single document from a collection associated with a model type
     * @param type 
     * @param query 
     * @param options 
     */
    async findOne<T>(type: Type<T>, query: Query<T>, options: FindOneOptionsEx<T> = {}) {

        const def = this.getOrCreateDefinition(type);
        const collection = this._db.collection(def.collName);
        this.formatOptions(options);

        const result = await collection.findOne(
            this.normalizeQuery(def, query),
            options
        );

        const document = result
            ? def.serializer.deserialize(CastIdsAsRefs(def, result))
            : null;

        await this.invokeHooks('findOne', { def, query, options, result: document });

        return document;

    }

    /**
     * 
     * @param type 
     * @param query 
     * @param options 
     */
    async find<T>(type: Type<T>, query: Query<T>, options: FindOneOptionsEx<T> = {}) {

        const def = this.getOrCreateDefinition(type);
        const collection = this._db.collection(def.collName);
        this.formatOptions(options);

        let cursor = collection.find(
            this.normalizeQuery(def, query),
            options
        );

        const result = await cursor.toArray();

        // convert to model instances
        const documents = result.map(d => def.serializer.deserialize(CastIdsAsRefs(def, d)));

        await this.invokeHooks('find', { def, query, options, result: documents });

        return documents;

    }

    /**
     * Insert a single document into the collection asssociated with a model type
     * @param obj 
     * @param options 
     */
    async insertOne<T>(obj: T, options: CollectionInsertOneOptions = {}) {

        const type = (obj as any).constructor;
        const def = this.getOrCreateDefinition(type);
        const collection = this._db.collection(def.collName);
        this.formatOptions(options);

        const document = this.prepareInsertOp(obj, def);

        const result = await collection.insertOne(document, options);

        if (result.insertedId) {
            (obj as any)[def.id.key] = result.insertedId.toHexString();
        }

        await this.invokeHooks('insertOne', { def, result, options, data: document });

        return result;

    }

    /**
     * Insert many documents into the collection asssociated with a model type
     * @param type 
     * @param docs 
     * @param options 
     */
    async insertMany<T>(type: Type<T>, docs: T[], options: CollectionInsertManyOptions = {}) {

        const def = this.getOrCreateDefinition(type);
        const collection = this._db.collection(def.collName);
        this.formatOptions(options);

        const documents = docs.map(d => this.prepareInsertOp(d, def));

        const result = await collection.insertMany(documents, options);

        // update id's
        docs.forEach((v, i) => {
            (v as any)[def.id.key] = result.insertedIds[i].toHexString();
        });


        await this.invokeHooks('insertMany', { def, result, options, data: documents });

        return result;
    }

    /**
     * Update one document with a model instance
     * 
     * @param obj 
     * @param extraOps 
     * @param options 
     */
    async updateOne<T>(obj: T, extraOps?: Update<T>, options: UpdateOneOptions = {}) {

        const type = (obj as any).constructor;
        const def = this.getOrCreateDefinition(type);
        const collection = this._db.collection(def.collName);
        this.formatOptions(options);

        // prepare the query based on the primary field
        const obj_id = (obj as any)[def.id.key];

        const query: any = {
            _id: obj_id ? new ObjectId(obj_id) : new ObjectId()
        };

        // prepare the update operation
        const op: any = this.prepareUpdateOp(obj, def, extraOps);

        // make the call
        const result = await collection.updateOne(query, op, options);

        // update id on object if upsert === true
        if (result.upsertedId) {
            (obj as any)[def.id.key] = result.upsertedId._id.toHexString();
        }

        await this.invokeHooks('updateOne', { def, result, options, op, target: obj });


        return result;
    }


    /**
     * 
     * @param type 
     * @param ops 
     * @param options 
     */
    async updateMany<T>(type: Type<T>, query: Query<T>, ops: Update<T>, options: UpdateManyOptions = {}) {

        const def = this.getOrCreateDefinition(type);
        const collection = this._db.collection(def.collName);
        this.formatOptions(options);


        const result = await collection.updateMany(
            this.normalizeQuery(def, query),
            ops,
            options
        );

        // run hooks

        await this.invokeHooks('updateMany', { def, result, options, query, op: ops });


        return result;

    }


    /**
     * Removes a document from the collection
     * @param obj 
     * @param options 
     */
    async deleteOne<T>(obj: T, options: FindOneAndDeleteOption = {}) {

        const type = (obj as any).constructor;
        const def = this.getOrCreateDefinition(type);
        const collection = this._db.collection(def.collName);
        this.formatOptions(options);

        // prepare the query based on the primary field
        const obj_id = (obj as any)[def.id.key];

        if (!obj_id) {
            throw new Error(`Cannot delete document without an id`);
        }

        const result = await collection.findOneAndDelete({ _id: new ObjectId(obj_id) }, options);

        await this.invokeHooks('deleteOne', <DeleteOneHookParams<T>>{ def, data: result.value, options, result });

        return result;

    }


    /**
     * Removes all documents matching the query
     * @param type 
     * @param query 
     * @param options 
     */
    async deleteMany<T>(type: Type<T>, query: Query<T>, options: CommonOptions = {}) {


        const def = this.getOrCreateDefinition(type);
        const collection = this._db.collection(def.collName);
        this.formatOptions(options);

        // fetch hook and run some
        const has_hooks = this.hasHooks('deleteMany');
        let documents: any[];

        //const delete_hooks = this.getHooks('delete');
        const q = this.normalizeQuery(def, query);

        // get documents into memory before running the delete op
        if (has_hooks) {
            const cursor = await collection.find(q);
            documents = await cursor.toArray();
        }

        const result = await collection.deleteMany(
            q,
            options
        );

        // run hooks
        await this.invokeHooks('deleteMany', <DeleteManyHookParams<T>>{ def, options, result, data: documents, query });

        return result;

    }


    /**
     * Execute an aggregation pipeline
     * @param query 
     * @param options 
     */
    async aggregate<T>(query: AggregateQuery<T>, options: CollectionAggregationOptions = {}) {

        const def = this.getOrCreateDefinition(query.type);
        const collection = this._db.collection(def.collName);
        this.formatOptions(options);

        let cursor = await collection.aggregate(query.pipeline, options);

        const result = await cursor.toArray();


        // run hooks
        await this.invokeHooks('aggregate', <AggregateHookParams<T>>{ def, options, result, query });


        return result;

    }


    /**
     * Fetch references for model instances.
     * Specify fields to fetch as object like field projection
     * 
     * 
     * @param list 
     * @param fields 
     */
    async dereference<T>() {

        throw new Error('Not implemented');
    }



    /**
     * Format common options depending on context state
     * @param options 
     */
    private formatOptions(options: any) {

        if (this._clientSession) {
            options.session = this._clientSession;
        }
    }

    /**
     * Get a model definition from type
     * @param type 
     */
    private getOrCreateDefinition<T>(type: Type<T>, throwOnNotFound = true) {


        if (this._options.collections.has(type)) {
            return this._options.collections.get(type) as ModelDefinition<T>;
        }

        // for non-persistent models
        const def = CreateModelDefinition(type, null, throwOnNotFound);
        this._options.collections.set(type, def);

        return def;


    }

    /**
     * Generate an update operation that mongo will understand
     * @param obj 
     * @param def 
     * @param out 
     * @param keyPrefix 
     */
    private prepareUpdateOp<T>(obj: T, def: ModelDefinition<T>, out?: any, keyPrefix?: string) {

        out = out || {};
        keyPrefix = keyPrefix ? keyPrefix + '.' : '';

        const m = (obj as any);
        const dirty = Model.GetMutations(obj);


        for (let i = 0; i < def.members.length; ++i) {

            const f = def.members[i];
            const prefixed_key = keyPrefix + f.key;

            // check if the field is dirty
            const is_dirty = dirty[f.key] != undefined;
            const member_def = this.getOrCreateDefinition(f.type, false);

            // update embeded child object fields in the case where
            // the whole object hasn't change
            if (f.model && !f.model.id && !is_dirty && m[f.key]) {
                this.prepareUpdateOp(m[f.key], member_def, out, prefixed_key);
            }

            if (is_dirty) {

                const value = m[f.key];

                // undefined value are added to $unset operator
                if (value === undefined) {
                    out.$unset = out.$unset || {};
                    out.$unset[prefixed_key] = "";
                }
                // otherwise just use $set operator
                else {

                    out.$set = out.$set || {};

                    if (f.model) {
                        out.$set[prefixed_key] = f.model.id
                            ? EnsureId(value, f.model.id)
                            : member_def.serializer.serialize(value);
                    }
                    else {
                        out.$set[prefixed_key] = value;
                    }

                }
            }

        }

        return out;

    }

    /**
     * Generate an insert operation that mongo will understand
     * @param obj 
     * @param def 
     */
    prepareInsertOp<T>(obj: T, def: ModelDefinition<T>) {

        const result: any = def.serializer.serialize(obj);
        delete result[def.id.key];

        for (let k in def.refsByKey) {
            let id = def.refsByKey[k];
            result[k] = new ObjectId(result[k][id.key]);
        }

        return result;

    }

    /**
     * Modify a query to be compatible with the mongo driver
     * @param def 
     * @param query 
     */
    private normalizeQuery<T>(def: ModelDefinition<T>, query: Query<T>) {

        const query_keys = Object.keys(query);

        for (let i = 0; i < query_keys.length; ++i) {

            const key = query_keys[i];
            const value = query[key];

            // handle _id
            if (key === '_id' || key === def.id.key) {
                delete query[key];
                query['_id'] = FormatQueryField(value, def.id);
                continue;
            }

            // handle persistent ref
            const ref = def.refsByKey[key];

            if (ref) {
                query[key] = FormatQueryField(value, ref);
            }
        }

        return query;

    }


    private async invokeHooks(name: 'count', options: CountHookParams<any>): Promise<void>;
    private async invokeHooks(name: 'findOne', options: FindOneHookParams<any>): Promise<void>;
    private async invokeHooks(name: 'find', options: FindHookParams<any>): Promise<void>;
    private async invokeHooks(name: 'insertOne', options: InsertOneHookParams<any>): Promise<void>;
    private async invokeHooks(name: 'insertMany', options: InsertManyHookParams<any>): Promise<void>;
    private async invokeHooks(name: 'updateOne', options: UpdateOneHookParams<any>): Promise<void>;
    private async invokeHooks(name: 'updateMany', options: UpdateManyHookParams<any>): Promise<void>;
    private async invokeHooks(name: 'deleteOne', options: DeleteOneHookParams<any>): Promise<void>;
    private async invokeHooks(name: 'deleteMany', options: DeleteManyHookParams<any>): Promise<void>;
    private async invokeHooks(name: 'aggregate', options: AggregateHookParams<any>): Promise<void>;


    private async invokeHooks(name: string, options: any) {

        const hooks = this._hooksByMethod[name];

        if (!hooks) {
            return;
        }

        const promises: Promise<any>[] = [];

        for (let i = 0, l = hooks.length; i < l; ++i) {

            let s: any = this._injector.get(hooks[i]);

            promises.push(s[name](options));
        }

        await Promise.all(promises);

    }

    private hasHooks(name: string): boolean {

        const hooks = this._hooksByMethod[name];

        if (hooks && hooks.length) {
            return true;
        }

        return false;
    }


}



export function CreateModelDefinition<T>(type: Type<T>, collName: string = null, throwOnNotFound = true) {

    const model: Model = FindModelAnnotation(type);

    if (!model) {

        if (throwOnNotFound) {
            throw new Error(`No @Model decorator found for type "${type.name}".`);
        }

        return null;
    }

    const id = model.id;
    const members = GetModelMembers(model);
    const refs: any = {};

    members.forEach((m) => {
        if (m.model && m.model.id) {
            refs[m.key] = m.model.id;
        }
    });

    const def: ModelDefinition<T> = {
        type,
        id,
        members,
        collName,
        refsByKey: refs,
        serializer: new JsonSerializer(type)
    };

    return def;


}



/**
 * cache for model definitions, by type
 */
const MODEL_DEF_CACHE = new Map<Type<any>, ModelDefinition<any>>();


function FormatQueryField(value: any, id: ID) {

    if (typeof value === 'object' && (Array.isArray(value.$in) || Array.isArray(value.$nin))) {

        if (value.$in) {
            value.$in = value.$in.map((v: any) => EnsureId(v, id));
        }

        if (value.$nin) {
            value.$nin = value.$nin.map((v: any) => EnsureId(v, id));
        }
    }
    else {
        value = EnsureId(value, id);
    }

    return value;

}

function EnsureId(value: any, id: ID) {

    if (Array.isArray(value)) {

        const result: any[] = [];
        for (let i = 0; i < value.length; ++i) {
            result.push(EnsureId(value[i], id));
        }

        return result;
    }

    if (id && value) {
        return new ObjectId(value[id.key] || value);
    }

    return value;
}

function CastIdsAsRefs<T>(def: ModelDefinition<T>, value: any) {

    const ref_keys = Object.keys(def.refsByKey);


    // map _id to model id field
    value[def.id.key] = value._id.toHexString();
    delete value._id;

    for (let i = 0; i < ref_keys.length; ++i) {

        const k = ref_keys[i];
        const id = def.refsByKey[k];

        if (value[k]) {

            if (Array.isArray(value[k])) {

                value[k].forEach((v: any, index: number) => {
                    value[k][index] = { [id.key]: ID_TO_STRING(value[k][index]) };
                })
            }
            else {
                value[k] = { [id.key]: ID_TO_STRING(value[k]) };
            }

        }

    }

    return value;

}

const ID_TO_STRING = (id: ObjectId) => id.toHexString();
