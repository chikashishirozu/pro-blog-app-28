const sqlite3 = require('sqlite3').verbose();
const { v4: uuidv4 } = require('uuid');

// SQLiteデータベースに接続
const db = new sqlite3.Database('blog.db');

// ユーザーIDを生成する関数
function generateUserId() {
    return uuidv4();
}

// データベースに新しいユーザーIDを挿入する関数
function insertUserIdIntoDatabase(userId, callback) {
    db.run('UPDATE users SET id = ? WHERE id = ?', [userId, userId], function(err) {
        if (err) {
            console.error('Error inserting id into database:', err.message);
        } else {
            console.log('id inserted successfully.');
        }
        callback(err);
    });
}

// データベースの更新処理を実行する
db.serialize(() => {
    db.each('SELECT id FROM users', (err, row) => {
        if (err) {
            console.error('Error fetching user id:', err.message);
            return;
        }
        
        const oldUserId = row.id;
        const newUserId = generateUserId();

        db.run('UPDATE users SET id = ? WHERE id = ?', [newUserId, oldUserId], function(err) {
            if (err) {
                console.error('Error updating user id in database:', err.message);
            } else {
                console.log(`User id ${oldUserId} updated to ${newUserId} successfully.`);
            }
        });
    }, (err) => {
        if (err) {
            console.error('Error iterating over users:', err.message);
        } else {
            console.log('All user ids updated successfully.');
        }

        // データベースの接続を閉じる
        db.close((err) => {
            if (err) {
                console.error('Error closing database connection:', err.message);
            } else {
                console.log('Database connection closed successfully.');
            }
        });
    });
});

