// モジュールのインポート
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const session = require('express-session');
// const SQLiteStore = require('connect-sqlite3')(session);
const fs = require('fs');
const bodyParser = require('body-parser');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcrypt');
const saltRounds = 10; // ソルトの生成に使用するラウンド数
const app = express();
const port = process.env.PORT || 3000;

app.use(express.static('public'));
app.use(express.urlencoded({extended: false}));
app.use(bodyParser.urlencoded({ extended: true }));

app.set('view engine', 'ejs');

// データベース接続
const db = new sqlite3.Database('./blog.db');

app.use(session({
    // store: new SQLiteStore,
    secret: 'my_secret_key',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false } // 開発環境ではfalse、本番環境ではtrueに設定
  }));

// ユーザーIDを生成する関数
function generateUserId() {
    return uuidv4();
}

// 日本標準時に合わせた日時フォーマットを生成する関数
function formatJSTDate() {
  const jstOffset = 9 * 60 * 60 * 1000; // JSTはUTCより9時間進んでいる
  const now = new Date();
  const jstDate = new Date(now.getTime() + jstOffset);
  return jstDate.toISOString().replace('T', ' ').replace(/\..+/, '');
}

// セッションデータをテンプレートに渡すミドルウェア
app.use((req, res, next) => {
  if (req.session.userId === undefined) {
    res.locals.username = 'ゲスト';
    res.locals.isLoggedIn = false;
  } else {
    res.locals.username = req.session.username;
    res.locals.isLoggedIn = true;
  }
  next();
});

// ルーティング設定
// トップページ
app.get('/', (req, res) => {
   db.all('SELECT * FROM articles ORDER BY id DESC LIMIT 5', (err, rows) => {
    if (err) {
      console.error(err);
      res.status(500).send('Internal Server Error');
      return;
    }
    res.render('top.ejs', { articles: rows });
  });
});


// 記事のリストを表示するルート
app.get('/list', (req, res) => {
  const perPage = 10;
  const page = parseInt(req.query.page) || 1;
  const offset = (page - 1) * perPage;

  db.all(`SELECT * FROM articles ORDER BY id DESC LIMIT ? OFFSET ?`, [perPage, offset], (err, rows) => {
    if (err) {
      console.error('Database query error:', err);
      return res.status(500).send('Internal Server Error');
    }

    db.get(`SELECT COUNT(*) AS count FROM articles`, (err, row) => {
      if (err) {
        console.error('Database count query error:', err);
        return res.status(500).send('Internal Server Error');
      }

      const count = row.count;
      const totalPages = Math.ceil(count / perPage);

      console.log('Total articles count:', count);
      console.log('PerPage:', perPage);
      console.log('Total pages:', totalPages);
      console.log('Current page:', page);

      res.render('list.ejs', {
        articles: rows,
        current: page,
        pages: totalPages // ここで pages 変数をテンプレートに渡しています
      });
    });
  });
});


  // すべての記事を取得するSQLクエリを実行
app.get('/articles', (req, res) => {
  db.all('SELECT * FROM articles ORDER BY created_at DESC', (err, rows) => {
    if (err) {
      console.error(err);
      res.status(500).send('Internal Server Error');
      return;
    }
    // クエリ結果をテンプレートに渡して表示します
    res.render('list.ejs', { articles: rows });
  });
});

// 記事詳細
app.get('/article/:id', (req, res) => {
  const id = req.params.id;
  const user_id = req.session.userId; // ログイン中のユーザーIDを取得
  // console.log('セッションユーザーID：', req.session.userId);

  db.get('SELECT articles.*, users.username FROM articles JOIN users ON articles.user_id = users.id WHERE articles.id = ?', [id], (err, article) => {
    if (err) {
      console.error('Database error:', err);
      res.status(500).send('Internal Server Error');
      return;
    }
    if (!article) {
      res.status(404).send('Article not found');
      return;
    }
    // res.locals を使用して user_id と isLoggedIn を設定
    res.locals.user_id = req.session.userId;
    res.locals.isLoggedIn = !!req.session.userId;
      
    res.render('article', {
      article: article,
      user_id: req.session.userId,
      isLoggedIn: !!req.session.userId
    });
  });
});
  
  
// 新しい記事の投稿フォームを表示するルート
app.get('/add-article', (req, res) => {
  res.render('add_articles.ejs', { errors: [] });
});
  
  // 新しい記事の追加
app.post('/add-article', (req, res) => {
  const { title, summary, content, category } = req.body;
  const created_at = formatJSTDate();
  const user_id = req.session.userId; // セッションからユーザーIDを取得
  const updated_at = formatJSTDate();  
  const errors = [];

  if (!user_id) {
    res.status(401).send('Unauthorized: Please log in');
    return;
  }
  if (!title) {
    errors.push('タイトルを入力してください');
  }
  if (!summary) {
    errors.push('概要を入力してください');
  }
  if (!content) {
    errors.push('コンテンツを入力してください');
  }
  if (!category) {
    errors.push('カテゴリーを入力してください');
  }
  if (category !== "all" && category !== "limited") {
    errors.push('カテゴリーは"all"または"limited"を入力してください');
  }

  if (errors.length > 0) {
    res.render('add_articles.ejs', { errors: errors });
  } else {
    db.run('INSERT INTO articles (title, summary, content, category, user_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [title, summary, content, category, user_id, created_at, updated_at],
      function (err) {
        if (err) {
          console.error(err);
          res.status(500).send('Internal Server Error');
          return;
        }
        const id = this.lastID; // 新しく追加された記事のIDを取得
        res.redirect('/article/' + id); // 記事の詳細ページにリダイレクト
      }
    );
  }
});


// 編集フォームの表示ルート
app.get('/article/:id/edit', (req, res) => {
  const id = req.params.id; 
  const user_id = req.session.userId;

  if (!user_id) {
    res.status(401).send('Unauthorized: Please log in');
    return;
  }

  db.get('SELECT * FROM articles WHERE id = ? AND user_id = ?', [id, user_id], (err, article) => {
    if (err) {
      console.error(err);
      res.status(500).send('Internal Server Error');
      return;
    }
    if (!article) {
      res.status(404).send('Article not found');
      return;
    }
    if (article.user_id !== user_id) {
      res.status(403).send('Forbidden: You can only edit your own articles');
      return;
    }
    res.render('edit_article.ejs', { article: article, errors: [] });
  });
});


// 記事の更新ルート
app.post('/article/:id/edit', (req, res) => {
  const id = req.params.id;
  const { title, summary, content, category } = req.body;
  const user_id = req.session.userId;
  const updated_at = formatJSTDate();
  const errors = [];

  if (!user_id) {
    res.status(401).send('Unauthorized: Please log in');
    return;
  }
  if (!title) {
    errors.push('タイトルを入力してください');
  }
  if (!summary) {
    errors.push('概要を入力してください');
  }
  if (!content) {
    errors.push('コンテンツを入力してください');
  }
  if (!category) {
    errors.push('カテゴリーを入力してください');
  }
    if (category !== "all" && category !== "limited") {
    errors.push('カテゴリーは"all"または"limited"を入力してください');
  }

  if (errors.length > 0) {
    db.get('SELECT * FROM articles WHERE id = ?', [id], (err, article) => {
      if (err) {
        console.error(err);
        res.status(500).send('Internal Server Error');
        return;
      }
      res.render('edit_article.ejs', { article: article, errors: errors });
    });
  } else {
    db.run('UPDATE articles SET title = ?, summary = ?, content = ?, category = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?',
      [title, summary, content, category, id, user_id],
      function (err) {
        if (err) {
          console.error(err);
          res.status(500).send('Internal Server Error');
          return;
        }
        res.redirect('/article/' + id);
      }
    );
  }
});


// 検索結果表示ルート
app.get('/search', (req, res) => {
  const query = req.query.query;
  db.all('SELECT * FROM articles WHERE title LIKE ? OR content LIKE ?', [`%${query}%`, `%${query}%`], (err, rows) => {
    if (err) {
      console.error(err);
      res.status(500).send('Internal Server Error');
      return;
    }
    res.render('search_results.ejs', { articles: rows, query: query });
  });
});

// 記事の削除
app.post('/article/:id/delete', (req, res) => {
  const id = req.params.id;
  const user_id = req.session.userId; // ログイン中のユーザーIDを取得 

  if (!user_id) {
    res.status(403).send('ログインが必要です');
    return;
  } 
  db.get('SELECT * FROM articles WHERE id = ?', [id], (err, article) => {
    if (err) {
      console.error(err);
      res.status(500).send('データベースエラーが発生しました');
      return;
    }
    if (article && article.user_id === user_id) {
      db.run('DELETE FROM articles WHERE id = ?', [id], (err) => {
        // ...（エラーハンドリングとリダイレクト）
        if (err) {
          console.error(err);
          res.status(500).send('記事の削除中にエラーが発生しました');
          return;
        }
        res.redirect('/articles?delete=success');
      });
    } else {
      res.status(404).send('記事が見つかりません');
    }
  });
});

// ログインページ
app.get('/login', (req, res) => {
  res.render('login.ejs');
});

// ログイン処理
app.post('/login', (req, res) => {
  const email = req.body.email;
  
  db.get('SELECT * FROM users WHERE email = ?', [email], (err, row) => {
    if (err) {
      console.error(err);
      res.status(500).send('Internal Server Error');
      return;
    } 
    if (row) {
      bcrypt.compare(req.body.password, row.password, function(err, result) {
        if (err) {
          console.error(err);
          res.status(500).send('Internal Server Error');
          return;
        }     
        if (result) {
          req.session.userId = row.id;
          req.session.username = row.username;
          res.redirect('/list');
        } else {
          req.session.error = 'パスワードが違います。';       
          res.redirect('/login');
        }
      });
    } else {
      req.session.error = 'メールアドレスが見つかりません。';    
      res.redirect('/login');
    }
  });
});

// ログアウト処理
app.get('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error(err);
      res.status(500).send('Internal Server Error');
      return;
    }
    res.redirect('/articles');
  });
});

// ユーザー一覧
app.get('/users', (req, res) => {
  db.all(`SELECT * FROM users`, [], (err, rows) => {
    if (err) {
      console.error(err.message);
      res.status(500).send('Internal Server Error');
      return;
    }
    res.json(rows);
  });
});

// 新規登録ページ
app.get('/signup', (req, res) => {
  res.render('signup.ejs', { errors: [] });
});

// 新しいユーザーの追加
app.post('/signup', (req, res) => {
  const { username, email, password, password_conform } = req.body; // password_conformを追加
  const userId = uuidv4(); // UUIDを生成
  const errors = [];

  // バリデーション
  if (!username) {
    errors.push('ユーザー名を入力してください');
  }
  if (!email) {
    errors.push('メールアドレスを入力してください');
  }
  if (!password) {
    errors.push('パスワードを入力してください');
  }
  if (password !== password_conform) {
    errors.push('パスワードが一致しません');
  }

  if (errors.length > 0) {
    res.render('signup.ejs', { errors: errors });
  } else {
    bcrypt.hash(password, saltRounds, function(err, hash) {
      if (err) {
        console.error(err);
        res.status(500).send('Internal Server Error');
        return;
      }  
      db.run('INSERT INTO users (id, username, email, password, created_at) VALUES (?, ?, ?, ?, ?)', 
        [userId, username, email, hash, created_at], 
        function(err) {
          if (err) {
            console.error(err);
            res.status(500).send('Internal Server Error');
            return;
          }
          res.redirect('/login');
        }
      );
    });
  }
});

// サーバーの起動
app.listen(3000, () => {
  console.log('Server is running on port ${port}');
});
