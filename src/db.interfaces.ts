import { ID, Member, JsonSerializer } from "@uon/model";
import { Type } from "@uon/core";
import { Query } from "./mongo/query.interface";
import { DeleteWriteOpResultObject, InsertWriteOpResult } from "mongodb";


export interface ModelDefinition<T> {
    type: Type<T>
    id: ID;
    members: Member[];
    refsByKey: { [k: string]: ID };
    collName: string;
    serializer: JsonSerializer<T>;
}

