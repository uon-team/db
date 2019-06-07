
import { Unpack, Include, PropertyNamesNotOfType } from '@uon/core';






export type QueryableModelMember<T, M = Pick<T, PropertyNamesNotOfType<T, Function>>> = {
    [K in keyof M]?: Unpack<M[K]>
    | Include<M[K], any[], ArrayQueryOp<M[K]>>
    | Include<M[K], object[], ElemMatchQueryOp<M[K]>>
    | Include<M[K], number, BitwiseQueryOp>
    | Include<M[K], string, RegexQueryOp | RegExp>
    | Include<M[K], number, ModuloQueryOp>
    | ComparisonQueryOp<M[K]>
    | ElementQueryOp
    // | GeospacialQueryOp
}



/**
 * Generic type for a mongo predicate based on a model type
 */
export type Query<T> = QueryableModelMember<T>
    & LogicalQueryOp<T>
    & WhereQueryOp
    & TextSearchQueryOp
    & CommentQueryOp
    & { [k: string]: any }


export interface ComparisonQueryOp<T, U = Unpack<T>> {

    /**
     * Matches values that are equal to a specified value.
     */
    $eq?: U;

    /**
     * Matches values that are greater than a specified value.
     */
    $gt?: U;

    /**
     * Matches values that are greater than or equal to a specified value.
     */
    $gte?: U;

    /**
     * Matches any of the values specified in an array.
     */
    $in?: U[];

    /**
     * Matches values that are less than a specified value.
     */
    $lt?: U;

    /**
     * Matches values that are less than or equal to a specified value.
     */
    $lte?: U;

    /**
     * Matches all values that are not equal to a specified value.
     */
    $ne?: U;

    /**
     * Matches none of the values specified in an array.
     */
    $nin?: U[];

}

export interface LogicalQueryOp<T> {

    /**
     * Joins query clauses with a logical AND returns all 
     * documents that match the conditions of both clauses.
     */
    $and?: Query<T>[];

    /**
     * Inverts the effect of a query expression and returns
     * documents that do not match the query expression.
     */
    $not?: Query<T>;

    /**
     * Joins query clauses with a logical NOR returns all
     * documents that fail to match both clauses.
     */
    $nor?: Query<T>[];

    /**
     * Joins query clauses with a logical OR returns all 
     * documents that match the conditions of either clause.
     */
    $or?: Query<T>[];
}



export interface ElementQueryOp {
    /**
     * Matches documents that have the specified field.
     */
    $exists?: boolean;

    /**
     * Selects documents if a field is of the specified type.
     */
    $type?: number;

}


export interface RegexQueryOp {

    /**
     * Selects documents where values match a specified regular expression.
     */
    $regex?: RegExp;

}

export interface ModuloQueryOp {

    /**
     * Performs a modulo operation on the value of a field and selects documents with a specified result.
     * Provide in the form [divider, remainder]. Matches if fieldValue % divider == remainder
     */
    $mod?: [number, number];

}


export interface WhereQueryOp {

    /**
     * Matches documents that satisfy a JavaScript expression.
     */
    $where?: Function;

}

export interface TextSearchQueryOp {


    /**
     * Performs text search.
     */
    $text?: TextSearchOptions;


}



export interface CommentQueryOp {

    /**
     * The $comment query operator associates a comment to any expression taking a query predicate.
     */
    $comment?: string;
}



export interface GeospacialQueryOp {

    /**
     * Selects geometries that intersect with a GeoJSON geometry. The 2dsphere index supports $geoIntersects.
     */
    $geoIntersects?: any;

    /**
     * Selects geometries within a bounding GeoJSON geometry. The 2dsphere and 2d indexes support $geoWithin.
     */
    $geoWithin?: any;

    /**
     * Returns geospatial objects in proximity to a point. Requires a geospatial index. The 2dsphere and 2d indexes support $near.
     */
    $near?: any;

    /**
     * Returns geospatial objects in proximity to a point on a sphere. Requires a geospatial index. The 2dsphere and 2d indexes support $nearSphere.
     */
    $nearSphere?: any;
}


export interface GeometrySpecifier {

    /**
     * Specifies a rectangular box using legacy coordinate pairs for $geoWithin queries. The 2d index supports $box.
     */
    $box?: any;

    /**
     * Specifies a circle using legacy coordinate pairs to $geoWithin queries when using planar geometry. The 2d index supports $center.
     */
    $center?: any;

    /**
     * Specifies a circle using either legacy coordinate pairs or GeoJSON format for $geoWithin queries when using spherical geometry. The 2dsphere and 2d indexes support $centerSphere.
     */
    $centerSphere?: any;

    /**
     * Specifies a geometry in GeoJSON format to geospatial query operators.
     */
    $geometry?: any;

    /**
     * Specifies a maximum distance to limit the results of $near and $nearSphere queries. The 2dsphere and 2d indexes support $maxDistance.
     */
    $maxDistance?: any;

    /**
     * Specifies a minimum distance to limit the results of $near and $nearSphere queries. For use with 2dsphere index only.
     */
    $minDistance?: any;

    /**
     * Specifies a polygon to using legacy coordinate pairs for $geoWithin queries. The 2d index supports $center.
     */
    $polygon?: any;
}

export interface ElemMatchQueryOp<T, U = Unpack<T>> {


    /**
     * Selects documents if element in the array field matches all the specified $elemMatch conditions.
     */
    $elemMatch?: Query<U>;


}

export interface ArrayQueryOp<T, U = Unpack<T>> {

    /**
     * Matches arrays that contain all elements specified in the query.
     */
    $all?: U[];

    /**
     * Selects documents if the array field is a specified size.
     */
    $size?: number;
}


export interface BitwiseQueryOp {

    /**
     * Matches numeric or binary values in which a set of bit positions all have a value of 0.
     */
    $bitsAllClear?: number | number[];

    /**
     * Matches numeric or binary values in which a set of bit positions all have a value of 1.
     */
    $bitsAllSet?: number | number[];

    /**
     * Matches numeric or binary values in which any bit from a set of bit positions has a value of 0.
     */
    $bitsAnyClear?: number | number[];

    /**
     * Matches numeric or binary values in which any bit from a set of bit positions has a value of 1.
     */
    $bitsAnySet?: number | number[];
}


export interface TextSearchOptions {

    $search: string;
    $language?: string;
    $caseSensitive?: boolean;
    $diacriticSensitive?: boolean;

}

type ProjectableModelMember<T, M = Pick<T, PropertyNamesNotOfType<T, Function>>> = {
    [K in keyof M]?:
    0 | 1
    | Include<M[K], any[], ArrayQueryProjectionOp<M[K]>>
    | Include<M[K], object[], ElemMatchQueryProjectionOp<M[K]>>
    | Include<M[K], string, MetaQueryProjectionOp>
};

export type QueryProjection<T> = ProjectableModelMember<T> & { [k: string]: 0 | 1 | MetaQueryProjectionOp | ArrayQueryProjectionOp<any> };




export interface ElemMatchQueryProjectionOp<T, U = Unpack<T>> {

    /**
     * Projects the first element in an array that matches the specified $elemMatch condition.
     */
    $elemMatch?: Query<U>;
}

export interface ArrayQueryProjectionOp<T, U = Unpack<T>> {

    /**
     * Limits the number of elements projected from an array.
     * Supports skip and limit slices as [skip, limit].
     */
    $slice?: number | [number, number];
}

export interface MetaQueryProjectionOp {

    /**
      * Projects the document’s score assigned during $text operation.
      */
    $meta?: "textScore";

}