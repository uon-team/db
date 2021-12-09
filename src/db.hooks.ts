import { Query } from "./mongo/query.interface";
import { AggregateOptions, BulkWriteOptions, CountDocumentsOptions, DeleteOptions, DeleteResult, FindOneAndDeleteOptions, InsertManyResult, InsertOneOptions, InsertOneResult, ModifyResult, UpdateOptions, UpdateResult } from "mongodb";
import { Type } from "@uon/core";
import { FindOptionsEx } from "./mongo/extensions.interface";
import { ModelDefinition } from "./db.interfaces";
import { AggregateQuery } from "./mongo/aggregate.interface";


export interface CommonHookParams {
    def: ModelDefinition<any>;
}

export interface CountHookParams<T = any> extends CommonHookParams {
    query: Query<T>
    options: CountDocumentsOptions;
    result: number;
}


export interface FindOneHookParams<T = any> extends CommonHookParams {
    query: Query<T>
    options: FindOptionsEx<T>;
    result: T;
}

export interface FindHookParams<T = any> extends CommonHookParams {
    query: Query<T>
    options: FindOptionsEx<T>;
    result: T[];
}

export interface InsertOneHookParams<T = any> extends CommonHookParams {
    data: T;
    options: InsertOneOptions;
    result: InsertOneResult<any>;
}

export interface InsertManyHookParams<T = any> extends CommonHookParams {
    data: T[];
    options: BulkWriteOptions;
    result: InsertManyResult<any>;
}

export interface UpdateOneHookParams<T = any> extends CommonHookParams {
    target: T;
    op: any;
    options: UpdateOptions;
    result: UpdateResult;
    value: T;
}

export interface UpdateManyHookParams<T = any> extends CommonHookParams {
    query: Query<T>;
    op: any;
    options: UpdateOptions;
    result: UpdateResult;
    values: T[];
}

export interface DeleteOneHookParams<T = any> extends CommonHookParams {
    data: T;
    options: FindOneAndDeleteOptions;
    result: ModifyResult<any>;
}

export interface DeleteManyHookParams<T = any> extends CommonHookParams {
    data: T[];
    query: Query<T>;
    options: DeleteOptions;
    result: DeleteResult;
}

export interface AggregateHookParams<T = any> extends CommonHookParams {
    query: AggregateQuery<T>;
    options: AggregateOptions;
    result: any[];
}





export interface IContextHook {

    count?<T = any>(params: CountHookParams<T>): any;

    findOne?<T = any>(params: FindOneHookParams<T>): any;

    find?<T = any>(params: FindHookParams<T>): any;

    insertOne?<T = any>(params: InsertOneHookParams<T>): any;

    insertMany?<T = any>(params: InsertManyHookParams<T>): any;

    updateOne?<T = any>(params: UpdateOneHookParams<T>): any;

    updateMany?<T = any>(params: UpdateManyHookParams<T>): any;

    deleteOne?<T = any>(params: DeleteOneHookParams<T>): any;

    deleteMany?<T = any>(params: DeleteManyHookParams<T>): any;

    aggregate?<T = any>(params: AggregateHookParams<T>): any;
}



export type DbHook = Type<IContextHook>;