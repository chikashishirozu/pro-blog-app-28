// ArticleList.js
import React, { useEffect, useState } from 'react';
import Article from './Article'; // Articleコンポーネントをインポート

const ArticleList = () => {
  const [articles, setArticles] = useState([]);
  const [error, setError] = useState(null); // エラーステートを追加

  useEffect(() => {
    fetch('/data/articles.json')
      .then(response => response.json())
      .then(data => setArticles(data))
      .catch(error => {
        console.error('Error fetching articles:', error);
        setError('記事データの取得に失敗しました'); // エラーメッセージを設定
      });
  }, []);

  if (error) {
    return <div>{error}</div>; // エラーがある場合に表示
  }

  return (
    <div>
      {articles.map(article => (
        <Article key={article.id} article={article} /> // Articleコンポーネントを使用
      ))}
    </div>
  );
};

export default ArticleList;

// Article.js
import React from 'react';
import { Link } from 'react-router-dom';

const Article = ({ article }) => {
  return (
    <div className="Article">
      <h2>{article.title}</h2>
      <p>{article.summary}</p>
      <p>Category: {article.category}</p>
      <p>Author: {article.user}</p>
      <p>Updated at: {new Date(article.updated_at).toLocaleString()}</p>
      <Link to={`/article/${article.id}`}>続きを読む</Link>
    </div>
  );
};

export default Article;

