import { Module, ModuleWithProviders, APP_INITIALIZER } from '@uon/core';
import { DbModuleConfig, DB_MODULE_CONFIG } from './db.config';
import { DbService } from './db.service';

import * as cluster from 'cluster';

@Module({
    imports: [],
    providers: [
        DbService
    ]
})
export class DbModule {

    constructor() { }

    static WithConfig(config: DbModuleConfig): ModuleWithProviders {

        return {
            module: DbModule,
            providers: [

                /**
                 * The module config
                 */
                {
                    token: DB_MODULE_CONFIG,
                    value: config
                },
               /* {
                    token: APP_INITIALIZER,
                    factory: async (service: DbService) => {

                        if (cluster.isMaster) {
                            const db_keys = Object.keys(config.databases);
                            for (let i = 0; i < config.databases.length; ++i) {
                                const db_def = config.databases[i];

                                if (db_def.syncIndicesOnStartup) {
                                    await service.syncIndices(db_def.name);
                                }
                            }
                        }
                    },
                    deps: [DbService],
                    multi: true
                }*/


            ]
        }
    }


}