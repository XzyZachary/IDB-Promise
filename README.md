# IDB-Promise
踩的坑很多。。后来也看到很多indexeddb的promise化，没有看到比较好的或者有的根本不靠谱
alasql貌似不错。几万数据的话还能撑住。 Dexie.js 不错的，用TS写的 但是需求不需要那么复杂就没采纳


坑点：
 1.  每次open database后 onsuccess 必须要 e.target.result.close()  不然之后再open的话会报错 AbortError  应该是库被block了
 2.   测试下来  平均插入1w的数据 耗时1s   后来20w的数据分了40组 每组5000个。。100w的话要10s。。。20w取出来的时候也要300ms左右。。。内容越少取出来越快
