
import { Unpack, PropertyNamesOfType, PropertyNamesNotOfType } from '@uon/core';



export type AssignmentOp<T> = Partial<Pick<T, PropertyNamesNotOfType<T, Function>>> & { [k: string]: any };

export type ArithmeticOp<T> = Partial<Pick<T, PropertyNamesOfType<T, number>>>;

export type ClampOp<T> = Partial<Pick<T, PropertyNamesOfType<T, Date | number>>>;

export type CurrentDateOp<T, U = Partial<Pick<T, PropertyNamesOfType<T, Date>>>> = {
    [K in keyof U]:
    true | CurrentDateUpdateOp
};

export type BitwiseOp<T, U = Partial<Pick<T, PropertyNamesOfType<T, number>>>> = {
    [K in keyof U]:
    ANDBitwiseUpdateOp | ORBitwiseUpdateOp | XORBitwiseUpdateOp
};

export type ArrayPopOp<T, U = Partial<Pick<T, PropertyNamesOfType<T, any[]>>>> = {
    [K in keyof U]:
    -1 | 1
};

export type ArrayAddToSetOp<T, U = Partial<Pick<T, PropertyNamesOfType<T, any[]>>>> = {
    [K in keyof U]: Unpack<U[K]> | ArrayEachOpModifier<U[K]>
};

export type ArrayPushOp<T, U = Partial<Pick<T, PropertyNamesOfType<T, any[]>>>> = {
    [K in keyof U]: Unpack<U[K]> | ArrayUpdateOpModifier<U[K]> | ArrayEachOpModifier<U[K]>
};

export type Update<T> = FieldUpdateOp<T> & ArrayUpdateOp<T> & BitwiseUpdateOp<T>;



export interface FieldUpdateOp<T> {


    /**
     * Sets the value of a field to current date, either as a Date or a Timestamp.
     */
    $currentDate?: CurrentDateOp<T>;

    /**
     * Increments the value of the field by the specified amount.
     */
    $inc?: ArithmeticOp<T>;

    /**
     * Only updates the field if the specified value is less than the existing field value.
     */
    $min?: ClampOp<T>;

    /**
     * Only updates the field if the specified value is greater than the existing field value.
     */
    $max?: ClampOp<T>;

    /**
     * Multiplies the value of the field by the specified amount.
     */
    $mul?: ArithmeticOp<T>;

    /**
     * Renames a field.
     */
    $rename?: { [k: string]: string };

    /**
     * Sets the value of a field in a document.
     */
    $set?: AssignmentOp<T>;

    /**
     * Sets the value of a field if an update results in an insert of a document.
     * Has no effect on update operations that modify existing documents.
     */
    $setOnInsert?: AssignmentOp<T>;

    /**
     * Removes the specified field from a document.
     */
    $unset?: AssignmentOp<T>;
}


export interface CurrentDateUpdateOp {
    $type?: 'date' | 'timestamp';
}



export interface ArrayUpdateOp<T> {


    /**
     * Adds elements to an array only if they do not already exist in the set.
     */
    $addToSet?: ArrayAddToSetOp<T>;

    /**
     * Removes the first or last item of an array.
     */
    $pop?: ArrayPopOp<T>;

    /**
     * Removes all array elements that match a specified query.
     */
    $pull?: any;

    /**
     * Adds an item to an array.
     */
    $push?: ArrayPushOp<T>;

    /**
     * Removes all matching values from an array.
     */
    $pullAll?: any;
}


export interface ArrayEachOpModifier<T> {

    /**
     * Modifies the $push and $addToSet operators to append multiple items for array updates.
     */
    $each?: T;

}


export interface ArrayUpdateOpModifier<T> {

    /**
     * Modifies the $push operator to specify the position in the array to add elements.
     */
    $position?: number;

    /**
     * Modifies the $push operator to limit the size of updated arrays.
     */
    $slice?: number;

    /**
     * Modifies the $push operator to reorder documents stored in an array.
     */
    $sort?: any;
}

export interface BitwiseUpdateOp<T> {

    /**
     * Apply a bitwise operation
     */
    $bit?: BitwiseOp<T>;
}


export interface ORBitwiseUpdateOp {
    or: number;
}

export interface XORBitwiseUpdateOp {
    xor: number;
}

export interface ANDBitwiseUpdateOp {
    and: number;
}