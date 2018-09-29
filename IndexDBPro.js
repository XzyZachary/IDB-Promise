import logger from '../utils/logger'
import {
    LOCAL_DATABASE_NAME
} from '../db'

export default class IndexedDB {
    constructor(name) {
        this.database = name
    }

    database = ''
    DB = window.indexedDB || indexedDB.mozIndexedDB || window.webkitIndexedDB || window.msIndexedDB
    //游标范围
    IDBKeyRange = window.IDBKeyRange || window.mozIndexedDB || window.webkitIDBKeyRange || window.msIDBKeyRange
    db = null

    _typeof(val) {
        return Object.prototype.toString.call(val)
    }

    isSupported() {
        if (this.DB) {
            return true
        } else {
            console.error(`Your browse doesn't support IndexedDB`)
            return false
        }
    }

    deleteDB(tableName) {
        this.close()
        return new Promise((res, rej) => {
            const request = this.DB.deleteDatabase(tableName)
            request.onsuccess = e => {
                res(e.target.readyState)
            }
            request.onerror = e => {
                rej(e.target.error)
            }
        })
    }

    _open(store) {
        return new Promise((res, rej) => {
            this.close()
            const request = this.DB.open(this.database, Date.now())
            request.onerror = e => {
                this.db = null
                rej(e.target.error)
            }
            request.onsuccess = () => {
                if (store && !request.result.objectStoreNames.contains(store)) {
                    res(false)
                }
                this.db = request.result
                res(request.result)
            }
        })
    }

    close() {
        if (this.db) {
            this.db.close()
            this.db = null
        }
    }

    addStore1(store, keyPath) {
        return new Promise((res, rej) => {
            if (!store) {
                rej(`This first param con't be empty`)
            }
            const request = this.DB.open(this.database, Date.now())
            request.onupgradeneeded = e => {
                const db = e.currentTarget.result
                if (db.objectStoreNames.contains(store)) {
                    console.log('existed')
                } else {
                    if (keyPath) {
                        db.createObjectStore(store, {
                            keyPath: keyPath
                        })
                    } else {
                        db.createObjectStore(store, {
                            autoIncrement: true
                        })
                    }

                }
            }
            request.onsuccess = e => {
                //console.log("onsuccess", store)
                e.target.result.close();
                this.close()
                res()
            }
            request.onerror = e => {
                this.db = null
                rej(e.target.error)
            }
        })
    }

    delStore(store) {
        return new Promise((res, rej) => {
            this.close()
            const request = this.DB.open(this.database, Date.now())
            request.onupgradeneeded = e => {
                let db = e.currentTarget.result
                if (db.objectStoreNames.contains(store)) {
                    db.deleteObjectStore(store)
                }
            }
            request.onerror = e => {
                rej(e.target.error)
            }
            request.onsuccess = e => {
                e.target.result.close()
                res()
            }
        })
    }


    get(store, key) {
        return new Promise(async (res, rej) => {
            try {
                const request = this.DB.open(this.database, Date.now())
                request.onsuccess = e => {
                    let db = e.target.result
                    const request2 = db.transaction([store], 'readonly').objectStore(store).get(key)
                    request2.onsuccess = e => {
                        let result = e.target.result
                        res(result)
                    }
                    request2.onerror = e => {
                        rej(e.target.error)
                    }
                    e.target.result.close()
                }
                // const transaction = db.transaction([store], 'readonly')
                // const objectStore = transaction.objectStore(store)
                // const request = objectStore.get(key)
                // request.onsuccess = e => {
                //     let result = e.target.result
                //     e.target.result.close()
                //     res(result)
                // }
                request.onerror = e => {
                    rej(e.target.error)
                }
            } catch (err) {
                rej(err)
            }
        })
    }


    _getRange(start, end) {
        if (typeof start === 'undefined' && typeof end === 'undefined') {
            return undefined
        }
        if (typeof start !== 'undefined' && typeof end === 'undefined') {
            return this.IDBKeyRange.upperBound(start)
        }
        if (typeof start === 'undefined' && typeof end !== 'undefined') {
            return this.IDBKeyRange.lowerBound(end)
        }
        if (typeof end === 'boolean') {
            return end ? this.IDBKeyRange.upperBound(start) : this.IDBKeyRange.lowerBound(start)
        }
        return end === start ? this.IDBKeyRange.only(start) : this.IDBKeyRange.bound(start, end)
    }


    find(store) {
        return new Promise(async (res, rej) => {
            try {
                this.close()
                const request = this.DB.open(this.database, Date.now())
                request.onsuccess = e => {
                    var db = e.target.result
                    let result = []
                    db.transaction([store], 'readonly').objectStore(store).openCursor().onsuccess = e => {
                        var cursor = e.target.result;
                        if (cursor) {
                            result.push(cursor.value);
                            cursor.continue(); //遍历了存储对象中的所有内容
                        } else {
                            this.close()
                            res(result)
                        }
                    }
                }
            } catch (err) {
                rej(err)
            }
        })
    }


    findPage({
        store,
        index,
        start,
        end,
        page = 1,
        num = 10,
        direction
    }) {
        return new Promise(async (res, rej) => {
            try {
                page = parseInt(page)
                num = parseInt(num)
                if (isNaN(page) || isNaN(num) || page < 1 || num < 1) {
                    rej(`The page and num must be number and greater than 0`)
                }

                const db = await this._open(store)
                const transaction = db.transaction([store], 'readonly')
                const objectStore = transaction.objectStore(store)
                const indexObj = objectStore.index(index)
                let range = this._getRange(start, end)
                const directionArr = ['next', 'nextunique', 'prev', 'preunique']
                if (!directionArr.includes(direction)) {
                    direction = 'next'
                }
                let request = indexObj.openCursor(range, direction)
                let requestCount = indexObj.count()
                let total = 0
                requestCount.onerror = e => {
                    rej(e.target.error)
                }
                requestCount.onsuccess = e => {
                    total = e.target.result
                    if (total <= num * (page - 1)) {
                        this.close()
                        res({
                            total,
                            list: []
                        })
                    }
                }
                let cursorNum = 0
                let list = []
                request.onsuccess = e => {
                    let cursor = e.target.result
                    cursorNum++
                    if (cursor && cursorNum <= page * num) {
                        if (cursorNum > num * (page - 1)) {
                            list.push(cursor.value)
                        }
                        cursor.continue()
                    } else {
                        this.close()
                        res({
                            total,
                            list
                        })
                    }
                }
            } catch (e) {
                rej(e)
            }
        })
    }


    _set(objectStore, val, key) {
        return new Promise(async (res, rej) => {
            let _key = key
            if (objectStore.keyPath === null) {
                _key = this._typeof(val) === '[object Object]' && Reflect.has(val, key) ? val[key] : key
            } else {
                if (this._typeof(val) === '[object Object]' && Reflect.has(val, objectStore.keyPath)) {
                    _key = undefined
                } else {
                    return rej(`The object store uses in-line keys and key was provied`)
                }
            }
            let request = _key ? objectStore.put(val, _key) : objectStore.put(val)
            request.onsuccess = e => {
                res(e.target.result)
            }
            request.onerror = e => {
                rej(e.target.error)
            }
        })
    }

    SaveDataNokey(objectstore, data) {
        return new Promise(async (res, rej) => {
            try {
                const request = this.DB.open(this.database)
                request.onsuccess = e => {
                    var version = e.target.result.version
                    this.close()
                    e.target.result.close();
                    const request2 = this.DB.open(this.database, version + 1)
                    request2.onsuccess = e => {
                        var store = e.target.result.transaction(objectstore, 'readwrite').objectStore(objectstore);
                        var request2 = store.add(data[0])
                        request2.onsuccess = e => {
                            this.close()
                            res(e.target.result)
                        }
                        request2.onerror = e => {
                            rej(e.target.error)
                        }
                        e.target.result.close();
                    }
                    request2.onerror = e => {
                        rej(e.target.error)
                    }
                }
                request.onerror = e => {
                    rej(e.target.error)
                }

            } catch (e) {
                rej(e)
            }
        })
    }



    del(store, start, end) {
        return new Promise(async (res, rej) => {
            try {
                const db = await this._open(store)
                const transaction = db.transaction([store], 'readwrite')
                const objectStore = transaction.objectStore(store)
                let request = typeof end === 'undefined' ? objectStore.delete(start) : objectStore.delete(this._getRange(start, end))
                request.onsuccess = e => {
                    this.close()
                    res(e.target.readyState)
                }
                request.onerror = e => {
                    rej(e.target.error)
                }
            } catch (e) {
                rej(e)
            }
        })
    }

    clear(store) {
        return new Promise((res, rej) => {
            this.close()
            const request = this.DB.open(this.database)
            request.onupgradeneeded = e => {
                let db = e.currentTarget.result
                console.log(db)
                if (db.objectStoreNames.contains(store)) {
                    const request2 = db.transaction([store], 'readwrite').objectStore(store).clear()
                    request2.onsuccess = e => {
                        this.close()
                        res(e.target.readyState)
                    }
                    request2.onerror = e => {
                        rej(e.target.error)
                    }
                }
            }
            request.onerror = e => {
                rej(e.target.error)
            }
            request.onsuccess = e => {
                this.close()
                res(e.target.readyState)
            }
        })
        // return new Promise(async (res, rej) => {
        //     try {
        //         this.close()
        //         const db = await this._open(store)
        //         console.log(store)
        //         if (db !== false) {
        //             const request = db.transaction([store], 'readwrite').objectStore(store).clear()
        //             request.onsuccess = e => {
        //                 this.close()
        //                 res(e.target.readyState)
        //             }
        //             request.onerror = e => {
        //                 rej(e.target.error)
        //             }
        //         }else{
        //             res(`objectstore is not exist`)
        //         }

        //     } catch (e) {
        //         rej(e)
        //     }
        // })
    }
    selectByKey(storeName, key) {
        //alert(2222)
        return new Promise((res, rej) => {
            logger.time(storeName)
            const request = this.DB.open(this.database, Date.now())
            request.onsuccess = e => {
                // alert(JSON.stringify(e.target.result.objectStoreNames))
                // alert(this.database)
                try {
                    var store = e.target.result.transaction([storeName]).objectStore(storeName);
                    let req = store.get(key);
                    // alert(22223333222)
                    req.onsuccess = () => {
                        res(req.result);
                        logger.timeEnd(storeName)
                        e.target.result.close();
                    }
                    req.onerror = rej
                } catch (e) {
                    //alert(e)
                    rej(e)
                }

            }
        })
    }
    putStore(storeName, data, key) {
        return new Promise((res, rej) => {
            try {
                const request = this.DB.open(this.database, Date.now())
                request.onsuccess = e => {
                    var store = e.target.result.transaction([storeName], 'readwrite').objectStore(storeName);
                    Promise.all(data.map((item, idx) => {
                        return new Promise((r, j) => {
                            var request2 = key ? store.put(item, item.TableKey) : store.put(item)
                            request2.onsuccess = e => {
                                r(e.target.readyState)
                            }
                            request2.onerror = e => {
                                j(e.target.error)
                            }
                        })
                    })).then(() => {
                        e.target.result.close()
                        res()
                    })
                }
                request.onerror = e => {
                    alert(323)
                    rej(e.target.error)
                }
            } catch (e) {
                rej(e)
            }
        })
    }
    batchInsert(storeName, data) {
        return new Promise((res, rej) => {
            try {
                var datas = data[1]
                var arr = [];
                while (datas.length) {
                    arr.push(datas.splice(0, 10000))
                }
                logger.time(storeName)
                const request = this.DB.open(this.database, Date.now())
                request.onsuccess = e => {
                    var store = e.target.result.transaction([storeName], 'readwrite').objectStore(storeName);
                    res(Promise.all(arr.map(item => {
                        return new Promise((r, j) => {
                            var request2 = store.put(item)
                            request2.onsuccess = e => {
                                r(e.target.readyState)
                            }
                            request2.onerror = e => {
                                j(e.target.error)
                            }
                        })
                    })).then(() => {
                        logger.timeEnd(storeName)
                        e.target.result.close();
                    }))
                }
                request.onerror = e => {
                    alert(323)
                    rej(e.target.error)
                }
            } catch (e) {
                rej(e)
            }
        })
    }
    batchInsert2(storeName, data) {
        return new Promise((res, rej) => {
            try {
                logger.time(storeName)
                const request = this.DB.open(this.database, Date.now())
                request.onsuccess = e => {
                    var store = e.target.result.transaction([storeName], 'readwrite').objectStore(storeName);
                    var request2 = store.add(data)
                    request2.onsuccess = e => {
                        res(e.target.readyState)
                    }
                    request2.onerror = e => {
                        rej(e.target.error)
                    }
                    var a = e.target.result
                    //e2.target.result.close();
                    e.target.result.close();
                    logger.timeEnd(storeName)
                    //alert(123)
                    res(a)
                }
                request.onerror = e => {
                    alert(223)
                    rej(e.target.error)
                }
            } catch (e) {
                rej(e)
            }
        })
    }

    addStore(storeName, data) {
        return new Promise((res, rej) => {
            try {
                var datas = data[1]
                var arr = [];
                while (datas.length) {
                    arr.push(datas.splice(0, 5000))
                }
                logger.time(storeName)
                const request = this.DB.open(this.database, Date.now())
                request.onupgradeneeded = e => {
                    var db = e.target.result;
                    if (!db.objectStoreNames.contains(storeName)) {
                        var objectStore = db.createObjectStore(storeName, {
                            autoIncrement: true
                        })
                        Promise.all(arr.map((item, idx) => {
                            return new Promise((r, j) => {
                                var request2 = objectStore.add(item)
                                request2.onsuccess = e => {
                                    r(e.target.readyState)
                                }
                                request2.onerror = e => {
                                    j(e.target.error)
                                }
                            })
                        }))
                    }
                }
                request.onsuccess = e => {
                    e.target.result.close()
                    logger.timeEnd(storeName)
                    res()
                }
                request.onerror = e => {
                    alert(JSON.stringify(e.target.error))
                    rej(e.target.error)
                }
            } catch (e) {
                rej(e)
            }
        })
    }


    batchInsert3(storeName, data) {
        return new Promise((res, rej) => {
            if (!data || data.length === 0) {
                rej('0000000000000000000000000000000');
                return;
            }
            var datas = data[1].reduce((rst, d) => {
                rst.push(data[0].reduce((item, {
                    ColumnName
                }, hIdx) => {
                    item[ColumnName] = d[hIdx]
                    return item
                }, {}))
                return rst
            }, [])
            var arr = []
            while (datas.length) {
                arr.push(datas.splice(0, 5000))
            }
            logger.time(storeName)
            const request = this.DB.open(this.database, Date.now())
            request.onsuccess = e => {
                res(Promise.all(arr.map((l) => {
                    var store = e.target.result.transaction([storeName], 'readwrite').objectStore([storeName])
                    return Promise.all(l.map(item => {
                        return new Promise((r, j) => {
                            var request2 = store.put(item)
                            request2.onsuccess = e => {
                                r(e.target.readyState)
                            }
                            request2.onerror = e => {
                                j(e.target.error)
                            }
                        })
                    }))
                })).then(() => {
                    logger.timeEnd(storeName)
                    e.target.result.close();
                }))
            }
        })
    }
    clearAllData() {
        let storeNameList = []
        let storeNames = this.db.objectStoreNames;
        if (storeNames && storeNames.length > 0) {
            for (let i = 0; i < storeNames.length; i++) {
                storeNameList.push(storeNames[i]);
            }
        }
        return Promise.all(
            storeNameList.map((storeName) => {
                return this.clear(storeName);
            })
        );

    }

    clear222(storeName) {
        return new Promise((resolve, reject) => {
            const request = this.DB.open(this.database, Date.now())
            request.onsuccess = () => {
                let transaction = this.db.transaction(storeName, 'readwrite')
                let store = transaction.objectStore(storeName)
                let req = store.clear()
                req.onsuccess = e => {
                    this.close()
                    resolve(e.target.readyState)
                }
                req.onerror = e => {
                    reject(e.target.error)
                }
            }
            request.onsuccess = e => {
                e.target.result.close()
                resolve();
            }
            request.onerror = reject;
        });
    }

    ClearByKeyPath(storeName, keys) {
        return new Promise((res, rej) => {
            const request = this.DB.open(this.database, Date.now())
            request.onsuccess = e => {
                var store = e.target.result.transaction([storeName], 'readwrite').objectStore(storeName)
                res(Promise.all(keys.map(item => {
                    return new Promise((r, j) => {
                        var request2 = store.delete(item)
                        request2.onsuccess = e => {
                            r(e.target.readyState)
                        }
                        request2.onerror = e => {
                            j(e.target.error)
                        }
                    })
                })).then(() => {
                    e.target.result.close();
                }))
            }
            request.onerror = e => {
                alert(323)
                rej(e.target.error)
            }
        })
    }



}