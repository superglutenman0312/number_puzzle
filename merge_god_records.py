import firebase_admin
from firebase_admin import credentials
from firebase_admin import firestore

# 1. 初始化 Firebase Admin SDK
# 請確保 serviceAccountKey.json 和這支腳本放在同一個目錄
cred = credentials.Certificate('serviceAccountKey.json')
if not firebase_admin._apps:
    firebase_admin.initialize_app(cred)

db = firestore.client()

def merge_god_records():
    print("🚀 開始執行神仙榜合併腳本 (依姓名合併最速紀錄)...\n")
    
    # 遍歷所有尺寸的神仙榜 (3x3 到 12x12)
    for size in range(3, 13):
        collection_name = f'god_records_{size}'
        print(f"正在整理: {collection_name} ...")
        
        records_ref = db.collection(collection_name)
        docs = records_ref.stream()
        
        # 用來暫存每個人的所有紀錄: { name: [(doc_id, time, data), ...] }
        user_records = {}
        
        for doc in docs:
            data = doc.to_dict()
            name = data.get('name', '匿名玩家').strip()
            time = data.get('time', 999999)
            
            # 排除 "匿名玩家"，不進行合併
            if name == "匿名玩家":
                continue
                
            if name not in user_records:
                user_records[name] = []
            
            user_records[name].append({
                'id': doc.id,
                'time': time
            })
            
        deleted_count = 0
        
        # 開始檢查重複並刪除較慢的紀錄
        for name, records in user_records.items():
            if len(records) > 1:
                # 依據時間由小到大排序 (最快的在前面)
                records.sort(key=lambda x: x['time'])
                
                # 保留第一筆 (最快)，其餘刪除
                best_record = records[0]
                to_delete = records[1:]
                
                for rec in to_delete:
                    db.collection(collection_name).document(rec['id']).delete()
                    deleted_count += 1
                
                print(f"  - 玩家 [{name}] 有 {len(records)} 筆紀錄，已保留最速 ({best_record['time']}s)，刪除 {len(to_delete)} 筆。")
        
        if deleted_count > 0:
            print(f"✅ {collection_name} 整理完成！共刪除 {deleted_count} 筆重複紀錄。")
        else:
            print(f"ℹ️ {collection_name} 無需合併。")
        print("-" * 50)

    print("\n🎉 神仙榜合併完畢！")

if __name__ == '__main__':
    merge_god_records()
