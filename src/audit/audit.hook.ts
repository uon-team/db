import { Injectable, Inject } from "@uon/core";
import { IContextHook, InsertOneHookParams, InsertManyHookParams, UpdateOneHookParams, UpdateManyHookParams, DeleteOneHookParams, DeleteManyHookParams } from "../db.hooks";
import { DbContext } from "../db.context";
import { AuditLogEntry } from "./entry.interface";
import { ObjectId } from 'mongodb';
import { DbModuleConfig, DB_MODULE_CONFIG } from "src/db.config";

export function AuditHook(userId: string, metadata?: any) {

    const user_id = new ObjectId(userId);
    const collection_name = 'audit_logs';

    return class extends AuditHookService implements IContextHook {

        async insertOne(params: InsertOneHookParams) {

            if (params.result.insertedCount < 1) {
                return;
            }
            const collection = this.context.db.collection(collection_name);

            const entry: AuditLogEntry = {
                userId: user_id,
                metadata,
                options: params.options,
                op: 'insert',
                collection: params.def.collName,
                oid: params.result.insertedId,
                opData: params.data,
                createdOn: new Date()
            };



            await collection.insertOne(entry);


        }

        async insertMany(params: InsertManyHookParams) {

            if (params.result.insertedCount < 1) {
                return;
            }

            const collection = this.context.db.collection(collection_name);

            const docs = params.data;

            const entries: any[] = docs.map((d, i) => {

                return <AuditLogEntry>{
                    userId: user_id,
                    metadata,
                    options: params.options,
                    op: 'insert',
                    collection: params.def.collName,
                    oid: params.result.insertedIds[i],
                    opData: d,
                    createdOn: new Date()
                };
            });

            await collection.insertMany(entries);

        }

        async updateOne<T>(params: UpdateOneHookParams) {

            if (params.result.modifiedCount < 1) {
                return;
            }

            params.target

            const collection = this.context.db.collection(collection_name);

            const oid = new ObjectId((params.target as any)[params.def.id.key]);

            const entry: AuditLogEntry = {
                userId: user_id,
                metadata,
                options: params.options,
                op: 'update',
                collection: params.def.collName,
                oid,
                opData: { _op: JSON.stringify(params.op) },
                createdOn: new Date()
            };

            await collection.insertOne(entry);

        }

        async updateMany(params: UpdateManyHookParams) {

            if (params.result.modifiedCount < 1) {
                return;
            }

            const collection = this.context.db.collection(collection_name);
            const real_collection = this.context.db.collection(params.def.collName);

            // find docs
            let cursor = await real_collection.find(params.query, { projection: { _id: 1 } });
            const docs = await cursor.toArray();

            const _op = JSON.stringify(params.op);

            const entries = docs.map((d) => {

                return <AuditLogEntry>{
                    userId: user_id,
                    metadata,
                    options: params.options,
                    op: 'update',
                    collection: params.def.collName,
                    oid: d._id,
                    opData: { _op },
                    createdOn: new Date()
                };

            });

            await collection.insertMany(entries);

        }

        async deleteOne(params: DeleteOneHookParams) {

            if (!params.data) {
                return;
            }

            const collection = this.context.db.collection(collection_name);

            const entry = {
                userId: user_id,
                metadata,
                options: params.options,
                op: 'delete',
                collection: params.def.collName,
                oid: params.data._id,
                opData: params.data,
                createdOn: new Date()
            };

            await collection.insertOne(entry);

        }


        async deleteMany(params: DeleteManyHookParams) {

            if (params.result.deletedCount < 1) {
                return;
            }

            const collection = this.context.db.collection(collection_name);

            const entries = params.data.map((d) => {

                return <AuditLogEntry>{
                    userId: user_id,
                    metadata,
                    options: params.options,
                    op: 'update',
                    collection: params.def.collName,
                    oid: d._id,
                    opData: d,
                    createdOn: new Date()
                };

            });

            await collection.insertMany(entries);

        }
    }
}


@Injectable()
export class AuditHookService {

    constructor(public context: DbContext, @Inject(DB_MODULE_CONFIG) public config: DbModuleConfig) {
    }

}