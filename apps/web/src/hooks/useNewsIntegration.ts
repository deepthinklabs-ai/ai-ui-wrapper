/**
 * News Integration Hook
 *
 * Fetches real-world news for AI characters to discuss.
 * Currently uses mock data - can be connected to NewsAPI, RSS feeds, or other sources.
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import type { NewsItem } from "@/types/cablebox";

type UseNewsIntegrationResult = {
  currentNews: NewsItem[];
  isLoading: boolean;
  error: string | null;
  refreshNews: () => Promise<void>;
};

// Mock news data for initial implementation
// TODO: Connect to real news API (NewsAPI, RSS feeds, etc.)
const MOCK_NEWS: NewsItem[] = [
  {
    id: "1",
    title: "Global Climate Summit Reaches Historic Agreement",
    description: "World leaders commit to ambitious carbon reduction targets by 2030",
    url: "https://example.com/climate",
    publishedAt: new Date().toISOString(),
    source: "World News Network",
  },
  {
    id: "2",
    title: "AI Technology Breakthrough Announced by Research Team",
    description: "New model shows unprecedented reasoning capabilities",
    url: "https://example.com/ai",
    publishedAt: new Date(Date.now() - 3600000).toISOString(),
    source: "Tech Daily",
  },
  {
    id: "3",
    title: "Major Sports Championship Ends in Dramatic Fashion",
    description: "Underdog team claims victory in final seconds",
    url: "https://example.com/sports",
    publishedAt: new Date(Date.now() - 7200000).toISOString(),
    source: "Sports Network",
  },
];

export function useNewsIntegration(): UseNewsIntegrationResult {
  const [currentNews, setCurrentNews] = useState<NewsItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Fetch news from source
   * Currently returns mock data - replace with real API call
   */
  const fetchNews = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // TODO: Replace with real news API call
      // Example using NewsAPI:
      // const response = await fetch(
      //   `https://newsapi.org/v2/top-headlines?country=us&apiKey=${apiKey}`
      // );
      // const data = await response.json();
      // const newsItems = data.articles.map((article: any) => ({
      //   id: article.url,
      //   title: article.title,
      //   description: article.description,
      //   url: article.url,
      //   publishedAt: article.publishedAt,
      //   source: article.source.name,
      // }));

      // Simulate API delay
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Use mock data for now
      setCurrentNews(MOCK_NEWS);
    } catch (err) {
      console.error("Error fetching news:", err);
      setError("Failed to fetch news");
      setCurrentNews([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Refresh news manually
   */
  const refreshNews = useCallback(async () => {
    await fetchNews();
  }, [fetchNews]);

  /**
   * Fetch news on mount
   */
  useEffect(() => {
    fetchNews();
  }, [fetchNews]);

  /**
   * Auto-refresh news every 30 minutes
   */
  useEffect(() => {
    const interval = setInterval(() => {
      fetchNews();
    }, 30 * 60 * 1000); // 30 minutes

    return () => clearInterval(interval);
  }, [fetchNews]);

  return {
    currentNews,
    isLoading,
    error,
    refreshNews,
  };
}
