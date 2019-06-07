import { Injectable, Type } from "@uon/core";
import { ObjectId } from 'mongodb';
import { DbService } from "../db.service";

@Injectable()
export class AuditService {

    constructor(private dbService: DbService) {

    }


    async list<T>(dbName: string, type: Type<T>, id: string, userId?: string) {

        const oid = new ObjectId(id);
    }

    async restore<T>(dbName: string, type: Type<T>, id: string, userId?: string) {

        const oid = new ObjectId(id);
    }

}