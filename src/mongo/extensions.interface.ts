import { FindOptions } from "mongodb";
import { QueryProjection } from "./query.interface";
import { SortableFields } from "./aggregate.interface";


export interface FindOptionsEx<T> {

    /**
     * The fields to project in the result
     */
    projection?: QueryProjection<T>;

    /**
     * Sort results
     */
    sort?: SortableFields<T>;

    limit?: number;

    skip?: number;
   

}
