import { MongoClient, Db, ClientSession, ObjectId, CountDocumentsOptions, Filter, DeleteOptions, FindOptions, OptionalId, InsertOneOptions, BulkWriteOptions, UpdateOptions, UpdateFilter, FindOneAndDeleteOptions, AggregateOptions, TransactionOptions, CommandOperationOptions, ChangeStreamOptions } from "mongodb";
import { Type, Injector, Provider, Unpack } from "@uon/core";
import { ID, JsonSerializer, Model, FindModelAnnotation, GetModelMembers, Member } from "@uon/model";
import { Query, QueryProjection } from "./mongo/query.interface";
import { ModelDefinition } from "./db.interfaces";
import { Update } from "./mongo/update.interface";
import { AggregateQuery } from "./mongo/aggregate.interface";
import { DbCollectionDefinition } from "./db.config";
import { DbHook, CountHookParams, FindOneHookParams, FindHookParams, InsertOneHookParams, InsertManyHookParams, UpdateOneHookParams, UpdateManyHookParams, DeleteOneHookParams, DeleteManyHookParams, AggregateHookParams } from "./db.hooks";
import { FindOptionsEx } from "./mongo/extensions.interface";
import { GetDbSchema } from "./db.metadata";



const HOOK_METHODS = ['count', 'findOne', 'find', 'insertOne', 'insertMany', 'updateOne', 'updateMany', 'deleteOne', 'deleteMany', 'aggregate'];

export interface DbContextOptions {

    /**
     * The mongo connection
     */
    client: MongoClient;

    /**
     * The mongo DB name
     */
    dbName: string;

    /**
     * The injector to use to instanciate hooks
     */
    injector: Injector;

    /**
     * A list of hooks to use
     */
    hooks: DbHook[];

}

export interface DbDereferenceOptions {
    assignNullToMissingDocument?: boolean;
};

const DEFAULT_DEREF_OPTIONS: DbDereferenceOptions = {
    assignNullToMissingDocument: true
};


/**
 * 
 */
export class DbContext {

    protected _client: MongoClient;
    protected _db: Db;
    private _hooksByMethod: { [k: string]: DbHook[] } = {};
    private _injector: Injector;
    protected _collections: Map<Type<any>, ModelDefinition<any>> = new Map();
    protected _session: ClientSession;

    constructor(private _options: DbContextOptions) {

        this._client = _options.client;
        this._db = this._client.db(_options.dbName);

        const providers = [
            <Provider>{ token: DbContext, value: this }
        ].concat(this._options.hooks);

        this._injector = Injector.Create(providers, _options.injector);

        // hooks setup
        this.setupHooks();

    }

    /**
     * Access to mongo Db interface
     */
    get db() {
        return this._db;
    }

    get client() {
        return this._client;
    }


    async watch<T>(type: Type<T>, pipeline: AggregateQuery<T>, options?: ChangeStreamOptions) {

        const def = this.getOrCreateDefinition(type);
        const collection = this._db.collection(def.collName);

        const change_stream = collection.watch(pipeline.pipeline, options);


    }

    /**
     * Count all documents matching the query
     * @param type 
     * @param query 
     * @param options 
     */
    async count<T>(type: Type<T>, query: Query<T>, options: CountDocumentsOptions = {}) {

        const def = this.getOrCreateDefinition(type);
        const collection = this._db.collection(def.collName);
        this.formatOptions(options);

        const result = await collection.countDocuments(
            this.normalizeTopLevelQuery(def, query) as any,
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
    async findOne<T>(type: Type<T>, query: Query<T>, options: FindOptionsEx<T> = {}) {

        const def = this.getOrCreateDefinition(type);
        const collection = this._db.collection(def.collName);
        this.formatOptions(options);

        const result = await collection.findOne(
            this.normalizeTopLevelQuery(def, query) as any,
            options as FindOptions
        );

        const document = result
            ? def.serializer.deserialize(CastIdsAsRefs(def.model, result))
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
    async find<T>(type: Type<T>, query: Query<T>, options: FindOptionsEx<T> = {}) {

        const def = this.getOrCreateDefinition(type);
        const collection = this._db.collection(def.collName);
        this.formatOptions(options);

        let cursor = collection.find(
            this.normalizeTopLevelQuery(def, query) as any,
            options as FindOptions
        );

        const result = await cursor.toArray();

        // convert to model instances
        const documents = result.map(d => def.serializer.deserialize(CastIdsAsRefs(def.model, d)));

        await this.invokeHooks('find', { def, query, options, result: documents });

        return documents;

    }

    /**
     * Insert a single document into the collection asssociated with a model type
     * @param obj 
     * @param options 
     */
    async insertOne<T>(obj: T, options: InsertOneOptions = {}) {

        const type = (obj as any).constructor;
        const def = this.getOrCreateDefinition(type);
        const collection = this._db.collection(def.collName);
        this.formatOptions(options);

        const document: OptionalId<any> = this.prepareInsertOp(obj, def);

        const result = await collection.insertOne(document, options);

        if (result.insertedId) {
            (obj as any)[def.id.key] = NormalizeModelId(def.id, result.insertedId);
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
    async insertMany<T>(type: Type<T>, docs: T[], options: BulkWriteOptions = {}) {

        const def = this.getOrCreateDefinition(type);
        const collection = this._db.collection(def.collName);
        this.formatOptions(options);

        const documents = docs.map(d => this.prepareInsertOp(d, def));

        const result = await collection.insertMany(documents, options);

        // update id's
        docs.forEach((v, i) => {
            (v as any)[def.id.key] = NormalizeModelId(def.id, result.insertedIds[i]);
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
    async updateOne<T>(obj: T, extraOps?: Update<T>, options: UpdateOptions = {}) {

        const type = (obj as any).constructor;
        const def = this.getOrCreateDefinition(type);
        const collection = this._db.collection(def.collName);
        this.formatOptions(options);

        // prepare the query based on the primary field
        const obj_id = (obj as any)[def.id.key];

        const query: any = {
            _id: obj_id ? new ObjectId(obj_id) : new ObjectId()
        };

        // fetch hook and run some
        const has_hooks = this.hasHooks('updateOne');
        let document: any;
        // get documents into memory before running the update op
        if (has_hooks) {
            document = await collection.findOne(query);
        }

        // format extra ops
        if (extraOps) {
            this.normalizeUpdateOp(def, extraOps);
        }

        // prepare the update operation
        const op: any = this.prepareSetUnsetUpdateOp(obj, def, extraOps);

        // make the call
        const result = await collection.updateOne(query, op, options);

        // update id on object if upsert === true
        if (result.upsertedId) {
            (obj as any)[def.id.key] = NormalizeModelId(def.id, result.upsertedId);
        }

        await this.invokeHooks('updateOne', { def, result, options, op, target: obj, value: document });


        return result;
    }


    /**
     * 
     * @param type 
     * @param ops 
     * @param options 
     */
    async updateMany<T>(type: Type<T>, query: Query<T>, ops: Update<T>, options: UpdateOptions = {}) {

        const def = this.getOrCreateDefinition(type);
        const collection = this._db.collection(def.collName);
        this.formatOptions(options);


        // fetch hook and run some
        const has_hooks = this.hasHooks('updateMany');
        let documents: any[];

        const q = this.normalizeTopLevelQuery(def, query);

        // get documents into memory before running the update op
        if (has_hooks) {
            const cursor = await collection.find(q as any);
            documents = await cursor.toArray();
        }

        // format ops
        this.normalizeUpdateOp(def, ops);

        const result = await collection.updateMany(
            q as any,
            ops as any,
            options
        );


        // run hooks
        await this.invokeHooks('updateMany', { def, result, options, query, op: ops, values: documents });


        return result;

    }


    /**
     * Removes a document from the collection
     * @param obj 
     * @param options 
     */
    async deleteOne<T>(obj: T, options: FindOneAndDeleteOptions = {}) {

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
    async deleteMany<T>(type: Type<T>, query: Query<T>, options: DeleteOptions = {}) {


        const def = this.getOrCreateDefinition(type);
        const collection = this._db.collection(def.collName);
        this.formatOptions(options);

        // fetch hook and run some
        const has_hooks = this.hasHooks('deleteMany');
        let documents: any[];

        //const delete_hooks = this.getHooks('delete');
        const q = this.normalizeTopLevelQuery(def, query);

        // get documents into memory before running the delete op
        if (has_hooks) {
            const cursor = await collection.find(q as any);
            documents = await cursor.toArray();
        }

        const result = await collection.deleteMany(
            q as any,
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
    async aggregate<T>(query: AggregateQuery<T>, options: AggregateOptions = {}) {

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
    async dereference<T>(docs: T[],
        fields: { [K in keyof T]?: QueryProjection<Unpack<T[K]>> },
        options: DbDereferenceOptions = DEFAULT_DEREF_OPTIONS) {

        if (docs.length === 0) {
            return docs;
        }


        const field_keys = Object.keys(fields) as (keyof T)[];

        const ref_list_by_type = new Map<Type<any>, string[]>();
        const proj_by_type = new Map<Type<any>, QueryProjection<any>>();

        const type = (docs[0] as any).constructor;
        const def = this.getOrCreateDefinition(type as Type<T>);

        const members: Member[] = [];

        for (let i = 0; i < field_keys.length; ++i) {
            const k = field_keys[i];
            const m = def.members.find((v, i, o) => {
                return v.key === k && v.model && v.model.id != null;
            });
            if (m) {
                // should be by field, but optimal this way
                proj_by_type.set(m.type, fields[k])
                members.push(m)
            }
        }

        for (let i = 0; i < docs.length; ++i) {

            const d: any = docs[i];

            for (let j = 0; j < members.length; ++j) {
                const m = members[j];
                const m_type = m.type;
                const m_def = this.getOrCreateDefinition(m_type, false);
                let id_list: string[] = ref_list_by_type.get(m_type);

                // lazy init of type map
                if (!id_list) {
                    id_list = [];
                    ref_list_by_type.set(m_type, id_list);
                }


                if (Array.isArray(d[m.key])) {

                    d[m.key].forEach((ref: any) => {
                        let canonical_id = ref[m_def.id.key].toString();
                        if (id_list.indexOf(canonical_id) === -1) {
                            id_list.push(canonical_id);
                        }
                    });

                }
                // or just a single ref
                else if (d[m.key]) {

                    let canonical_id = d[m.key][m_def.id.key].toString();
                    if (id_list.indexOf(canonical_id) === -1) {
                        id_list.push(canonical_id);
                    }

                }

            }
        }

        // much promise
        var promises: Promise<any>[] = [];
        var value_map = new Map();

        // go over all ref lists by type
        for (let [type, idList] of ref_list_by_type) {

            let col_def = this.getOrCreateDefinition(type, false);

            let map_by_id: any = {};
            value_map.set(type, map_by_id);

            // find all objects
            let p = this.find(type, { '_id': { $in: idList } }, {
                projection: proj_by_type.get(type)
            }).then((results) => {
                results.forEach((r) => {
                    map_by_id[r[col_def.id.key]] = r;
                });

            });

            promises.push(p);

        }

        // wait for fetches to complete
        await Promise.all(promises);


        // finally assign the proper object where they belong
        for (let i = 0, l = docs.length; i < l; ++i) {

            let model = docs[i] as any;

            // go over all referenced keys
            for (let j = 0; j < members.length; ++j) {

                let f = members[j];
                let field_type = f.type;

                let col_def = this.getOrCreateDefinition(field_type, false);
                //console.log(col_def);

                // get the id list for this type
                let values = value_map.get(field_type);

                // get the placeholder object
                let old_value = model[f.key];

                // ignore the rest if value undefined
                if (!old_value) {
                    continue;
                }

                // if we got an array of references
                if (Array.isArray(old_value)) {

                    // we want to replace elements in place to not mess up the ordering
                    old_value.forEach((v: any, index: number) => {

                        let canonical_id = v[col_def.id.key];

                        if (values[canonical_id] !== undefined) {
                            old_value[index] = values[canonical_id];
                        }
                        // we might want to assign null for missing documents
                        else if (options.assignNullToMissingDocument === true) {

                            old_value[index] = null;
                        }


                    });
                }
                // or just a single ref
                else {


                    let canonical_id = old_value[col_def.id.key].toString();

                    // assign new value if it is defined
                    if (values[canonical_id] !== undefined) {
                        model[f.key] = values[canonical_id];
                    }
                    // we might want to assign null for missing documents
                    else if (options.assignNullToMissingDocument === true) {
                        model[f.key] = null;
                    }
                }
                Model.MakeClean(model, [f.key]);

            }

        }

        return docs;

    }



    /**
     * Format common options depending on context state
     * @param options 
     */
    private formatOptions(options: CommandOperationOptions) {

        if (this._session) {
            options.session = this._session;
        }
    }

    /**
     * Get a model definition from type
     * @param type 
     */
    private getOrCreateDefinition<T>(type: Type<T>, throwOnNotFound = true) {

        if (this._collections.has(type)) {
            return this._collections.get(type) as ModelDefinition<T>;
        }

        // for non-persistent models
        const def = CreateModelDefinition(type, null, throwOnNotFound);
        this._collections.set(type, def);

        return def;


    }


    private normalizeUpdateOp<T>(def: ModelDefinition<T>, ops: any) {

        for (let k in ops) {

            // $pull has special behavior, it's a query
            if (k === '$pull') {
                let keys = Object.keys(ops[k]);
                for (let pk in ops[k]) {
                    let m = def.members.find((mem) => {
                        return mem.key === pk;
                    });

                    if (m?.model) {
                        let mdef = this.getOrCreateDefinition(m.type, false);
                        this.normalizeTopLevelQuery(mdef, ops[k][pk]);
                    }

                }
            }
            else {
                CastRefsAsIds(def.model, ops[k]);
            }

        }
    }

    /**
     * Generate an update operation that mongo will understand
     * @param obj 
     * @param def 
     * @param out 
     * @param keyPrefix 
     */
    private prepareSetUnsetUpdateOp<T>(obj: T, def: ModelDefinition<T>, out?: any, keyPrefix?: string) {

        out = out || {};
        keyPrefix = keyPrefix ? keyPrefix + '.' : '';

        const m = (obj as any);
        const dirty: any = Model.GetMutations(obj);

        // prepare $set and $unset on dirty fields
        for (let i = 0; i < def.members.length; ++i) {

            const f = def.members[i];
            const prefixed_key = keyPrefix + f.key;

            // check if the field is dirty
            const is_dirty = dirty[f.key] != undefined;
            const member_def = this.getOrCreateDefinition(f.type, false);

            // update embeded child object fields in the case where
            // the whole object hasn't change
            if (f.model && !f.model.id && !is_dirty && m[f.key]) {
                this.prepareSetUnsetUpdateOp(m[f.key], member_def, out, prefixed_key);
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
                            : Array.isArray(value)
                                ? value.map(v => CastRefsAsIds(f.model as Model, member_def.serializer.serialize(v)))
                                : CastRefsAsIds(f.model as Model, member_def.serializer.serialize(value));
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
     * Generate an insert operation
     * @param obj 
     * @param def 
     */
    prepareInsertOp<T>(obj: T, def: ModelDefinition<T>) {

        const result: any = def.serializer.serialize(obj);

        if (result[def.id.key]) {
            result._id = new ObjectId(result[def.id.key]);
            delete result[def.id.key];
        }

        CastRefsAsIds(def.model, result);

        return result;

    }

    /**
     * Modify a query to be compatible with the mongo driver
     * @param def 
     * @param query 
     */
    private normalizeTopLevelQuery<T>(def: ModelDefinition<T>, query: Query<T>) {

        if (Array.isArray(query['$or'])) {
            query['$or'].forEach((v) => {
                this.normalizeTopLevelQuery(def, v);
            });
        }
        else if (Array.isArray(query['$and'])) {
            query['$and'].forEach((v) => {
                this.normalizeTopLevelQuery(def, v);
            });
        }
        else {
            const query_keys = Object.keys(query);

            for (let i = 0; i < query_keys.length; ++i) {

                const key = query_keys[i];
                const value = query[key];


                // handle _id
                if (def.id && (key === '_id' || key === def.id.key)) {
                    delete query[key];
                    (query as any)['_id'] = FormatQueryField(value, def.id);
                    continue;
                }

                // handle persistent ref
                const ref = def.refsByKey[key];
                if (ref) {
                    (query as any)[key] = FormatQueryField(value, ref);
                    continue;
                }

                // handle embedded
                const member = def.members.find(m => m.key === key);
                if (member?.model) {
                    let mdef = this.getOrCreateDefinition(member.type, false);
                    this.normalizeTopLevelQuery(mdef, value);
                }

            }
        }

        return query;

    }


    private normalizeQuery<T>(def: ModelDefinition<T>, query: Query<T>) {

        // handle _id
        if (def.id && (query[def.id.key] || query['_id'])) {
            let val = query[def.id.key] || query['_id'];
            delete query[def.id.key];
            (query as any)['_id'] = FormatQueryField(val, def.id);
        }

        const query_keys = Object.keys(query).filter(k => k !== '_id');

        for (let i = 0; i < query_keys.length; ++i) {

            const key = query_keys[i];
            const value = query[key];

            // handle persistent ref
            const ref = def.refsByKey[key];
            if (ref) {
                (query as any)[key] = FormatQueryField(value, ref);
                continue;
            }

        }


    }

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

    private setupHooks() {

        const hooks = this._options.hooks;
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
    const refs: any = {
        //...id && { '_id': id, [id.key]: id }
    };
    const ref_paths: any = {};
    let coll_name: string = collName;
    if (id) {
        const schema_def = GetDbSchema(type);
        coll_name = schema_def.collection; // model.name + (typeof model.version == 'number' ? `_v${Math.floor(model.version)}` : '');
    }


    members.forEach((m) => {
        const mdl = m.model;
        if (mdl) {
            if (mdl.id) {
                refs[m.key] = m.model.id;
            }
        }
    });

    const def: ModelDefinition<T> = {
        type,
        model,
        id,
        members,
        collName: coll_name,
        refsByKey: refs,
        serializer: new JsonSerializer(type)
    };

    return def;


}


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

function CastIdsAsRefs<T>(model: Model, value: any) {

    // map _id to model id field, if defined
    if (value._id && model.id) {
        value[model.id.key] = NormalizeModelId(model.id, value._id);
        delete value._id;
    }

    const members = GetModelMembers(model);

    // check id member are themselves models 
    for (let i = 0; i < members.length; ++i) {

        const mem = members[i];
        const k = mem.key;

        if (value[k] && mem.model) {

            // persistant id
            if (mem.model.id) {

                if (Array.isArray(value[k])) {
                    value[k].forEach((v: any, index: number) => {
                        value[k][index] = { [mem.model.id.key]: NormalizeModelId(mem.model.id, value[k][index]) };
                    });
                }
                else {
                    value[k] = { [mem.model.id.key]: NormalizeModelId(mem.model.id, value[k]) };
                }

            }
            else {
                // go deep

                if (Array.isArray(value[k])) {
                    value[k].forEach((v: any, index: number) => {
                        CastIdsAsRefs(mem.model as Model, value[k][index]);
                    });
                }
                else {
                    CastIdsAsRefs(mem.model as Model, value[k]);
                }
            }
        }

    }

    return value;

}

function CastRefsAsIds<T>(model: Model, value: any) {

    const members = GetModelMembers(model);

    for (let i = 0; i < members.length; ++i) {

        const mem = members[i];
        const k = mem.key;

        if (value[k] && mem.model) {
            // persistant id
            if (mem.model.id) {

                if (Array.isArray(value[k])) {
                    value[k] = value[k].map((v: any) => new ObjectId(v[mem.model.id.key]));
                }
                else {

                    if (value[k]['$each']) {
                        value[k]['$each'] = value[k]['$each'].map((v: any) => new ObjectId(v[mem.model.id.key]));
                    }
                    else {
                        value[k] = new ObjectId(value[k][mem.model.id.key]);
                    }
                }
            }
            else {
                // go deep
                if (Array.isArray(value[k])) {
                    //console.log(value[k]);
                    value[k].forEach((v: any, index: number) => {
                        CastRefsAsIds(mem.model as Model, value[k][index]);
                    });
                }
                else {

                    if (value[k]['$each']) {
                        value[k]['$each'].forEach((v: any, index: number) => {
                            CastRefsAsIds(mem.model as Model, value[k]['$each'][index]);
                        });
                    }
                    else {
                        CastRefsAsIds(mem.model as Model, value[k]);
                    }
                }
            }

        }
    }

    return value;

}

function NormalizeModelId(meta: ID, value: ObjectId) {

    if (meta.type === String) {
        return value.toHexString()
    }
    else if (meta.type === ObjectId) {
        return value;
    }

    // unsupported id type
    throw new Error('unsupported ID type')
}