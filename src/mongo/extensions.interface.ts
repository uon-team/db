import { FindOneOptions } from "mongodb";
import { QueryProjection } from "./query.interface";
import { SortableFields } from "./aggregate.interface";


export interface FindOneOptionsEx<T> extends FindOneOptions {

    /**
     * The fields to project in the result
     */
    projection?: QueryProjection<T>;

    /**
     * Sort results
     */
    sort?: SortableFields<T>;


}
