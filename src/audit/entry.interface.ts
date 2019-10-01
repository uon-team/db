import { ObjectId } from "mongodb";
import { Model, ID } from "@uon/model";

export type AuditLogOp = 'delete' | 'restore' | 'insert' | 'update' ;

export interface AuditLogEntry {
    _id?: ObjectId;
    userId: ObjectId;
    metadata: object;
    collection: string;
    oid: ObjectId;
    op: AuditLogOp;
    opData: object;
    createdOn: Date;
    expiresOn?: Date;
    options?: object;
}

@Model()
export class AuditEntry {

    @ID()
    id: string;
    
    userId: ObjectId;
}