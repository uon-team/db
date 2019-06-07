

import { Type, Include, Unpack, PropertyNamesNotOfType } from "@uon/core";
import { Query, MetaQueryProjectionOp } from "./query.interface";

export type SortableFields<T, U = Partial<Pick<T, PropertyNamesNotOfType<T, Function>>>> = {
    [K in keyof U]:
    -1 | 1 | MetaQueryProjectionOp
} & {
    [k: string]:
    -1 | 1 | MetaQueryProjectionOp
};


/**
 * An aggregate query builder
 */
export class AggregateQuery<T> {


    private _pipeline: any[] = [];

    constructor(readonly type: Type<T>) {

    }

    /**
     * Get the access to the full generated pipeline
     */
    get pipeline() {
        return this._pipeline;
    }


    /**
     * Adds a match stage to the pipeline
     * @param query 
     */
    match(query: Query<T>) {

        this._pipeline.push({
            $match: query
        });

        return this;
    }

    /**
     * Adds a field projection stage to the pipeline
     * @param query 
     */
    project<P extends AggregateProjection<T>>(query: AggregateProjection<T> & P): AggregateQuery<T & P> {
        this._pipeline.push({
            $project: query
        });
        return (<any>this) as AggregateQuery<T & P>;
    }




    /**
     * Adds a group stage to the pipeline
     * @param query 
     */
    group<G extends AggregateGroup<T>>(query: G): AggregateQuery<T & G> {

        this._pipeline.push({
            $group: query
        });
        return (<any>this) as AggregateQuery<T & G>;
    }


    /**
     * Limit the result count to the value provided
     * @param count 
     */
    limit(count: number) {

        this._pipeline.push({
            $limit: count
        });

        return this;
    }

    /**
     * Skip the specified number of documents in the results
     * @param count 
     */
    skip(count: number) {

        this._pipeline.push({
            $skip: count
        });

        return this;
    }


    /**
     * Sort the result
     * @param fields 
     */
    sort(fields: SortableFields<T>) {

        this._pipeline.push({
            $sort: fields
        });
        return this;
    }


    /**
     * Writes the output of the aggregate query into a collection
     * with name {colName}
     * 
     * WARNING: this will replace the collection if it exists
     * @param colName 
     */
    out(colName: string) {

        this._pipeline.push({
            $out: colName
        });

        return this;
    }




}


export type ExpressionValue = number | string | Date | boolean;

export type AnyExpression =
    BooleanExpression
    | SetExpression
    | ComparisonExpression
    | ArithmeticExpression
    | StringExpression
    | ArrayExpression
    | VariableExpression
    | LiteralExpression
    | DataTypeExpression
    | DateExpression
    | ConditionalExpression
    | AccumulatorExpression
    | TextSearchExpression;


export type AggregateProjectionAnyValue = {
    [k: string]:
    0 | 1
    | string
    | string[]
    | AnyExpression
    | AggregateProjectionAnyValue
};

export type AggregateProjection<T, U = Partial<Pick<T, PropertyNamesNotOfType<T, Function>>>> = {
    [K in keyof U]:
    0 | 1
    | ConditionalExpression
    | Include<U[K], object[], AggregateProjection<Unpack<U[K]>>>
} & AggregateProjectionAnyValue;


export type AggregateGroup<T> =
    { _id: null | string | { [k: string]: string | AnyExpression } }
    | { [K in keyof T]: string | AccumulatorExpression }
    | { [k: string]: AccumulatorExpression };


export interface BooleanExpression {
    /**
     * Returns true only when all its expressions evaluate to true. 
     * Accepts any number of argument expressions.
     */
    $and?: AnyExpression[];

    /**
     * Returns true when any of its expressions evaluates to true. 
     * Accepts any number of argument expressions.
     */
    $or?: AnyExpression[];

    /**
     * Returns the boolean value that is the opposite of its argument expression. 
     * Accepts a single argument expression.
     */
    $not?: AnyExpression;
}


export interface SetExpression {

    /**
     * Returns true if the input sets have the same distinct elements. 
     * Accepts two or more argument expressions.
     */
    $setEquals?: any;

    /**
     * Returns a set with elements that appear in all of the input sets. 
     * Accepts any number of argument expressions.
     */
    $setIntersection?: any;

    /**
     * Returns a set with elements that appear in any of the input sets. 
     * Accepts any number of argument expressions.
     */
    $setUnion?: any;

    /**
     * Returns a set with elements that appear in the first set but not in
     * the second set; i.e. performs a relative complement of the second set
     * relative to the first. 
     * Accepts exactly two argument expressions.
     */
    $setDifference?: any;

    /**
     * Returns true if all elements of the first set appear in the second set,
     * including when the first set equals the second set; i.e. not a strict 
     * subset. 
     * Accepts exactly two argument expressions.
     */
    $setIsSubset?: any;

    /**
     * Returns true if any elements of a set evaluate to true; 
     * otherwise, returns false. 
     * Accepts a single argument expression.
     */
    $anyElementTrue?: any;

    /**
     * Returns true if no element of a set evaluates to false, 
     * otherwise, returns false. 
     * Accepts a single argument expression.
     */
    $allElementsTrue?: any;


}

export type ComparableExpressionValue = [ExpressionValue | AnyExpression, ExpressionValue | AnyExpression];

export interface ComparisonExpression {

    /**
     * Returns: 0 if the two values are equivalent, 1 if the first 
     * value is greater than the second, and -1 if the first
     * value is less than the second.
     */
    $cmp?: ComparableExpressionValue;

    /**
     * Returns true if the values are equivalent.
     */
    $eq?: ComparableExpressionValue;

    /**
     * Returns true if the first value is greater than the second.
     */
    $gt?: ComparableExpressionValue;

    /**
     * Returns true if the first value is greater than or equal to the second.
     */
    $gte?: ComparableExpressionValue;

    /**
     * Returns true if the first value is less than the second.
     */
    $lt?: ComparableExpressionValue;

    /**
     * Returns true if the first value is less than or equal to the second.
     */
    $lte?: ComparableExpressionValue;

    /**
     * Returns true if the values are not equivalent.
     */
    $ne?: ComparableExpressionValue;
}


export interface ArithmeticExpression {

    /**
     * 	Returns the absolute value of a number.
     */
    $abs?: string | number | AnyExpression;

    /**
     * Adds numbers to return the sum, or adds numbers and a date
     * to return a new date. If adding numbers and a date, treats the numbers
     * as milliseconds. Accepts any number of argument expressions, but at most,
     * one expression can resolve to a date.
     */
    $add?: any;

    /**
     * Returns the smallest integer greater than or equal to the specified number.
     */
    $ceil?: any;

    /**
     * Returns the result of dividing the first number by the second. 
     * Accepts two argument expressions.
     */
    $divide?: any;

    /**
     * Raises e to the specified exponent.
     */
    $exp?: any;

    /**
     * Returns the largest integer less than or equal to the specified number.
     */
    $floor?: any;

    /**
     * Calculates the natural log of a number.
     */
    $ln?: any;

    /**
     * Calculates the log of a number in the specified base.
     */
    $log?: any;

    /**
     * Calculates the log base 10 of a number.
     */
    $log10?: any;

    /**
     * Returns the remainder of the first number divided by the second. 
     * Accepts two argument expressions.
     */
    $mod?: any;

    /**
     * Multiplies numbers to return the product. 
     * Accepts any number of argument expressions.
     */
    $multiply?: any;

    /**
     * Raises a number to the specified exponent.
     */
    $pow?: any;

    /**
     * Calculates the square root.
     */
    $sqrt?: any;

    /**
     * Returns the result of subtracting the second value from the first. 
     * If the two values are numbers, return the difference. 
     * If the two values are dates, return the difference in milliseconds. 
     * If the two values are a date and a number in milliseconds, return the resulting date. 
     * Accepts two argument expressions. 
     * If the two values are a date and a number, specify the date argument first 
     * as it is not meaningful to subtract a date from a number.
     */
    $subtract?: any;

    /**
     * Truncates a number to its integer.
     */
    $trunc?: any;

}

export interface StringExpression {

    /**
     * Concatenates any number of strings.
     */
    $concat?: any;

    /**
     * Searches a string for an occurence of a substring and returns
     * the UTF-8 byte index of the first occurence. 
     * If the substring is not found, returns -1.
     */
    $indexOfBytes?: any;


    /**
     * Searches a string for an occurence of a substring and 
     * returns the UTF-8 code point index of the first occurence. 
     * If the substring is not found, returns -1.
     */
    $indexOfCP?: any;

    /**
     * Splits a string into substrings based on a delimiter. 
     * Returns an array of substrings. If the delimiter is not found
     *  within the string, returns an array containing the original string.
     */
    $split?: any;

    /**
     * Returns the number of UTF-8 encoded bytes in a string.
     */
    $strLenBytes?: any;

    /**
     * Returns the number of UTF-8 code points in a string.
     */
    $strLenCP?: any;

    /**
     * Performs case-insensitive string comparison and returns: 0 if two
     * strings are equivalent, 1 if the first string is greater than 
     * the second, and -1 if the first string is less than the second.
     */
    $strcasecmp?: any;

    /**
     * Deprecated. Use $substrBytes or $substrCP.
     * @deprecated
     */
    $substr?: any;

    /**
     * Returns the substring of a string. Starts with the character at
     * the specified UTF-8 byte index (zero-based) in the string and 
     * continues for the specified number of bytes.
     */
    $substrBytes?: any;

    /**
     * Returns the substring of a string. Starts with the character at 
     * the specified UTF-8 code point (CP) index (zero-based) in the 
     * string and continues for the number of code points specified.
     */
    $substrCP?: any;

    /**
     * Converts a string to lowercase. 
     * Accepts a single argument expression.
     */
    $toLower?: any;

    /**
     * Converts a string to uppercase. 
     * Accepts a single argument expression.
     */
    $toUpper?: any;

}


export interface ArrayExpression {


    /**
     * Returns the element at the specified array index.
     */
    $arrayElemAt?: any;

    /**
     * Converts an array of key value pairs to a document.
     */
    $arrayToObject?: any;

    /**
     * Concatenates arrays to return the concatenated array.
     */
    $concatArrays?: any;

    /**
     * Selects a subset of the array to return an array with only the elements 
     * that match the filter condition.
     */
    $filter?: any;

    /**
     * Returns a boolean indicating whether a specified value is in an array.
     */
    $in?: any;

    /**
     * Searches an array for an occurence of a specified value and returns 
     * the array index of the first occurence. 
     * If the substring is not found, returns -1.
     */
    $indexOfArray?: any;


    /**
     * Determines if the operand is an array. Returns a boolean.
     */
    $isArray?: any;

    /**
     * Applies a subexpression to each element of an array and returns 
     * the array of resulting values in order. 
     * Accepts named parameters.
     */
    $map?: any;

    /**
     * Converts a document to an array of documents representing key-value pairs.
     */
    $objectToArray?: any;

    /**
     * Outputs an array containing a sequence of integers according to user-defined inputs.
     */
    $range?: any;

    /**
     * Applies an expression to each element in an array and combines them into a single value.
     */
    $reduce?: any;

    /**
     * Returns an array with the elements in reverse order.
     */
    $reverseArray?: any;

    /**
     * Returns the number of elements in the array. Accepts a single expression as argument.
     */
    $size?: any;

    /**
     * Returns a subset of an array.
     */
    $slice?: any;

    /**
     * Merge two arrays together.
     */
    $zip?: any;

}

export interface VariableExpression {

    /**
     * Defines variables for use within the scope of a subexpression 
     * and returns the result of the subexpression. 
     * Accepts named parameters.
     */
    $let: any;
}

export interface LiteralExpression {

    /**
     * Return a value without parsing. Use for values that the 
     * aggregation pipeline may interpret as an expression. 
     * For example, use a $literal expression to a string that 
     * starts with a $ to avoid parsing as a field path.
     */
    $literal: any;
}

export interface DataTypeExpression {

    /**
     * Return the BSON data type of the field.
     */
    $type: any;
}

export interface DateExpression {

    /**
     * Returns the day of the year for a date as a number between 1 
     * and 366 (leap year).
     */
    $dayOfYear?: any;

    /**
     * Returns the day of the month for a date as a number between 1 
     * and 31.
     */
    $dayOfMonth?: any;

    /**
     * Returns the day of the week for a date as a number between 1 
     * (Sunday) and 7 (Saturday).
     */
    $dayOfWeek?: any;

    /**
     * Returns the year for a date as a number (e.g. 2014).
     */
    $year?: any;

    /**
     * Returns the month for a date as a number between 1 (January) 
     * and 12 (December).
     */
    $month?: any;

    /**
     * Returns the week number for a date as a number between 0 
     * (the partial week that precedes the first Sunday of the year) 
     * and 53 (leap year).
     */
    $week?: any;

    /**
     * Returns the hour for a date as a number between 0 and 23.
     */
    $hour?: any;

    /**
     * Returns the minute for a date as a number between 0 and 59.
     */
    $minute?: any;

    /**
     * Returns the seconds for a date as a number between 0 and 60 (leap seconds).
     */
    $second?: any;

    /**
     * Returns the milliseconds of a date as a number between 0 and 999.
     */
    $millisecond?: any;

    /**
     * Returns the date as a formatted string.
     */
    $dateToString?: any;

    /**
     * Returns the weekday number in ISO 8601 format, ranging from 
     * 1 (for Monday) to 7 (for Sunday).
     */
    $isoDayOfWeek?: any;

    /**
     * Returns the week number in ISO 8601 format, ranging from 1 to 53. 
     * Week numbers start at 1 with the week (Monday through Sunday) that 
     * contains the year’s first Thursday.
     */
    $isoWeek?: any;

    /**
     * Returns the year number in ISO 8601 format. The year starts with 
     * the Monday of week 1 (ISO 8601) and ends with the Sunday of the 
     * last week (ISO 8601).
     */
    $isoWeekYear?: any;

}


export interface ConditionalExpression {

    /**
     * A ternary operator that evaluates one expression, and depending 
     * on the result, returns the value of one of the other two expressions. 
     * Accepts either three expressions in an ordered list or three named parameters.
     */
    $cond?: any;


    /**
     * Returns either the non-null result of the first expression or the result 
     * of the second expression if the first expression results in a null result. 
     * Null result encompasses instances of undefined values or missing fields. 
     * Accepts two expressions as arguments. 
     * The result of the second expression can be null.
     */
    $ifNull?: any;


    /**
     * Evaluates a series of case expressions. When it finds an expression which
     * evaluates to true, $switch executes a specified expression and breaks 
     * out of the control flow.
     */
    $switch?: any;
}


/**
 * 
 */
export interface AccumulatorExpression {

    /**
     * Returns a sum of numerical values. Ignores non-numeric values.
     * Changed in version 3.2: Available in both $group and $project stages.
     */
    $sum?: any;

    /**
     * Returns an average of numerical values. Ignores non-numeric values.
     * Changed in version 3.2: Available in both $group and $project stages.
     */
    $avg?: any;

    /**
     * Returns a value from the first document for each group.Order is only defined if the documents are in a defined order.
     * Available in $group stage only.
     */
    $first?: any;

    /**
     * Returns a value from the last document for each group.Order is only defined if the documents are in a defined order.
     * Available in $group stage only.
     */
    $last?: any;

    /**
     * Returns the highest expression value for each group.
     * Changed in version 3.2: Available in both $group and $project stages.
     */
    $max?: any;

    /**
     * Returns the lowest expression value for each group.
     * Changed in version 3.2: Available in both $group and $project stages.
     */
    $min?: any;

    /**
     * Returns an array of expression values for each group.
     * Available in $group stage only.
     */
    $push?: any;

    /**
     * Returns an array of unique expression values for each group.Order of the array elements is undefined.
     * Available in $group stage only.
     */
    $addToSet?: any;

    /**
     * Returns the population standard deviation of the input values.
     * Changed in version 3.2: Available in both $group and $project stages.
     */
    $stdDevPop?: any;

    /**
     * Returns the sample standard deviation of the input values.
     * Changed in version 3.2: Available in both $group and $project stages.
     */
    $stdDevSamp?: any;

}



export interface TextSearchExpression {

    /**
     * Access text search metadata.
     */
    $meta?: any;
}
