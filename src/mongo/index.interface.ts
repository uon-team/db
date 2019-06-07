import { IndexOptions } from "mongodb";


/**
 * Exposes interface members
 */
export type IndexableMemberMap<T> = {
    [K in keyof T]?:
    T[K] extends Function
    ? never
    : 1 | -1 | 'text' | '2dsphere' | '2d' | 'geoHaystack'
} & {
    [k: string]: 1 | -1 | 'text' | '2dsphere' | '2d' | 'geoHaystack'
};


/**
 * IndexDefinition
 */
export interface IndexDefinition<T> extends IndexOptions {

    /**
     * The name of the index, be as verbose as possible
     */
    name: string;

    /**
     *  A map of fields and their index type
     */
    fields: IndexableMemberMap<T>,

    /**
     * Whether the indexed value should be unique
     */
    unique?: boolean;

    /**
     * Force index to be sparse
     */
    sparse?: boolean;

    /**
     *  the index collation
     */
    collation?: {
        locale: string;
        strength?: number;
    };

    /**
     * Define a time to live in seconds
     */
    expireAfterSeconds?: number;

    /**
     * The default language to use for text indices
     */
    default_language?: string;

    /**
     * Override for the default field name for language
     */
    language_override?: string;

}
