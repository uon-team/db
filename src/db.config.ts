import { InjectionToken, Type, PropertyNamesNotOfType } from "@uon/core";
import { } from "./db.interfaces";
import { IndexDefinition } from "./mongo/index.interface";
import { MongoClientOptions } from "mongodb";


export const DB_MODULE_CONFIG = new InjectionToken<DbModuleConfig>("DB_MODULE_CONFIG");


export type MappableFields<T, M = Pick<T, PropertyNamesNotOfType<T, Function>>> =  {
    [K in keyof M]?: string
};

export interface DbCollectionDefinition<T> {

    /**
     * The collection name
     */
    name: string;

    /**
     * The model class
     */
    model: Type<T>;

    /**
     * List of indexes to create / sync
     */
    indices: IndexDefinition<T>[];

    /**
     * An hashmap of fields to map model to DB and vice-versa
     * in the format [modelKey]: 'dbFieldKey'
     */
    mapFields?: MappableFields<T>;


}


export interface DbConnectionConfig {

    /**
     * The name of the database connection to be able to retrieve it later
     */
    name: string;

    /**
     * The mongo url
     */
    url: string;

    /**
     * Extra options to pass to the mongo client
     */
    options?: MongoClientOptions;

}



export interface DbModuleConfig {

    /**
     * A list of mongos to initiate connections with
     */
    connections: DbConnectionConfig[];

    


}