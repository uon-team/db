import { ID, Member, JsonSerializer, Model } from "@uon/model";
import { Type } from "@uon/core";
import { Query } from "./mongo/query.interface";

export interface ModelDefinition<T> {
    type: Type<T>;
    model: Model;
    id: ID;
    members: Member[];
    refsByKey: { [k: string]: ID };
    collName: string;
    serializer: JsonSerializer<T>;
}

