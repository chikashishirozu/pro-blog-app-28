# pro-blog-app-28
```
https://zusann123.blogspot.com/2025/01/image.html
```
# ブログのセキュリティレベル

今の構成
```
Helmet
RateLimit
Session
CSRF
bcrypt
sanitize-html
```
# Steps required to start and run the application

Install nodejs22.12.0(LTS), sqlite3
```
$ npm install

$ npm outdated
```
# Specify IP address or port, default is 127.0.0.1:3000
```
$ node app.js 127.0.0.1 3003 or $ node app.js
```
# sqliteDB

``` bash
CREATE INDEX idx_articles_id ON articles(id);
CREATE INDEX idx_articles_title ON articles(title);
CREATE INDEX idx_users_email ON users(email);

CREATE VIRTUAL TABLE articles_fts USING fts5(
title,
content,
content='articles',
content_rowid='id'
);

INSERT INTO articles_fts(rowid, title, content)
SELECT id, title, content FROM articles;

SELECT rowid
FROM articles_fts
WHERE articles_fts MATCH 'AI';

または

SELECT rowid
FROM articles_fts
WHERE articles_fts MATCH 'blog';
```
