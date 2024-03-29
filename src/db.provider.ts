import { DbCollectionDefinition } from './db.config';
import { DbContext } from './db.context';
import { Type } from '@uon/core';
import { DbService } from './db.service';



export function ProvideDbContext<T extends DbContext>(connectionName: string,
    dbName: string,
    token?: Type<T>) {

    return {
        token: token || DbContext,
        factory: (service: DbService) => {
            return service.createContext(connectionName, dbName);
        },
        deps: [DbService]
    };

}