import { Module, ModuleWithProviders, APP_INITIALIZER } from '@uon/core';
import { DbModuleConfig, DB_MODULE_CONFIG } from './db.config';
import { DbService } from './db.service';

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

            ]
        }
    }


}