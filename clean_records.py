import firebase_admin
from firebase_admin import credentials
from firebase_admin import firestore

# 1. 初始化 Firebase Admin SDK
# 請確保 serviceAccountKey.json 和這支腳本放在同一個目錄
cred = credentials.Certificate('serviceAccountKey.json')
firebase_admin.initialize_app(cred)

db = firestore.client()

def clean_leaderboard():
    print("🚀 開始執行 Firebase 資料清洗腳本...\n")
    
    # 遍歷所有尺寸的排行榜 (3x3 到 12x12)
    for size in range(3, 13):
        collection_name = f'records_{size}'
        god_collection_name = f'god_records_{size}'
        
        print(f"正在處理集合: {collection_name} ...")
        
        # 取得該尺寸的所有紀錄
        records_ref = db.collection(collection_name)
        docs = records_ref.stream()
        
        moved_count = 0
        
        for doc in docs:
            data = doc.to_dict()
            time = data.get('time', 0)
            moves = data.get('moves', 0)
            
            # 判斷是否為腳本 (時間<=0 或 每秒步數>10)
            if time <= 0 or (moves / time) > 10:
                # 1. 將資料複製到神仙榜 (保持原本的 document ID，這樣同一個裝置不會重複上傳)
                db.collection(god_collection_name).document(doc.id).set(data)
                
                # 2. 從一般榜中刪除該筆資料
                db.collection(collection_name).document(doc.id).delete()
                
                moved_count += 1
                
        print(f"✅ {collection_name} 處理完成！共將 {moved_count} 筆腳本紀錄移至 {god_collection_name}。")
        print("-" * 50)

    print("\n🎉 所有資料清洗完畢！現在你的排行榜乾淨了。")

if __name__ == '__main__':
    clean_leaderboard()