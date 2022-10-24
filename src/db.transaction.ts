import { ClientSession, TransactionOptions } from "mongodb";
import { DbContext } from "./db.context";




export class DbTransaction extends DbContext {

    constructor(parentContext: DbContext) {
        super({
            client: parentContext.client,
            dbName: parentContext.db.databaseName,
            hooks: [],
            injector: null
        });
    }


    start(options?: TransactionOptions) {
        if (this._session) {
            throw new Error('Session already started');
        }

        this._session = this.client.startSession();
        this._session.startTransaction(options);

        return this;
    }

    async commit() {
        const result = await this._session.commitTransaction();
        return result;
    }

    async abort() {
        const result = await this._session.abortTransaction();
        return result;
    }

    async end() {
        if (!this._session) {
            throw new Error('No active session started');
        }

        await this._session.endSession();
        this._session = null;
    }


}


export async function WithTransaction<T = void>(db: DbContext, cb: (db: DbContext) => Promise<T>, options?: TransactionOptions) {

    const t = new DbTransaction(db);
    t.start(options);

    let result: any;
    let error: any;
    try {
        result = await cb(t);
        await t.commit()
    }
    catch(ex) {
        await t.abort();
        error = ex;
    }

    await t.end();

    if(error) {
        throw error;
    }

    return result;
    
}