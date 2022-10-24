import { FindMetadataOfType, GetMetadata, GetOrDefineMetadata, Type } from "@uon/core";
import { FindModelAnnotation, Model } from "@uon/model";
import { IndexDefinition } from "./mongo/index.interface";


export interface PersistentModelOptions<T> {
    collection: string;
    indices?: IndexDefinition<T>[];
};


const DB_SCHEMA_META_KEY = "db:schema";

export function DefineDbSchema<T>(type: Type<T>, options: PersistentModelOptions<T>) {

    const model: Model = FindModelAnnotation(type);
    if (!model) {
        throw new Error(`No @Model decorator found for type "${type.name}".`);
    }

    if (!model.id) {
        throw new Error(`Model must have a property decorated with @ID()`);
    }

    GetOrDefineMetadata(DB_SCHEMA_META_KEY, type, undefined, options);
}

export function GetDbSchema<T>(type: Type<T>) {
    const meta = GetMetadata(DB_SCHEMA_META_KEY, type) as PersistentModelOptions<T> | null;
    if(!meta) {
        throw new Error(`Model does not have DB Schema attached (see DefineDbSchema())`);
    }
    return meta;
}