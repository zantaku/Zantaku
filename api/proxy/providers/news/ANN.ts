import axios from 'axios';
import { XMLParser } from 'fast-xml-parser';

export interface NewsItem {
  id: string;
  title: string;
  source: string;
  timestamp: string;
  url: string;
  thumbnail?: string | null;
  category: string;
  isInternalLink: boolean;
  description?: string;
  author?: string;
}

export class ANNProvider {
  private static readonly BASE_URL = 'https://www.animenewsnetwork.com/all/rss.xml?ann-edition=w';
  
  static async fetchNews(maxItems: number = 10): Promise<NewsItem[]> {
    try {
      console.log('🔍 Fetching ANN news...');
      
      const response = await axios.get(this.BASE_URL, {
        timeout: 10000,
        headers: {
          'User-Agent': 'Kamilist-App/1.0'
        }
      });
      
      const parser = new XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: "@_"
      });
      
      const feed = parser.parse(response.data);
      const items = Array.isArray(feed.rss.channel.item) 
        ? feed.rss.channel.item 
        : [feed.rss.channel.item];

      const newsItems = items.slice(0, maxItems).map((item: any, index: number) => {
        // Extract thumbnail from description HTML
        const thumbnailMatch = item.description?.match(/src="([^"]+)"/);
        const thumbnail = thumbnailMatch ? thumbnailMatch[1] : null;
        
        // Clean up title
        const title = item.title?.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
        
        return {
          id: `ann-${Date.now()}-${index}`,
          title: title || 'Untitled',
          source: 'ANN',
          timestamp: new Date(item.pubDate).toISOString(),
          url: item.link || '',
          thumbnail,
          category: 'News',
          isInternalLink: false,
          description: item.description?.replace(/<[^>]*>/g, '').substring(0, 200) + '...',
          author: item.author || 'ANN Staff'
        };
      });

      console.log(`✅ ANN: Fetched ${newsItems.length} news items`);
      return newsItems;
      
    } catch (error) {
      console.error('❌ Error fetching ANN news:', error);
      return [];
    }
  }
  
  static isAvailable(): boolean {
    return true; // ANN RSS is generally always available
  }
  
  static getSourceInfo() {
    return {
      name: 'Anime News Network',
      description: 'Latest anime and manga news from ANN',
      categories: ['anime', 'manga', 'industry'],
      language: 'en',
      updateFrequency: '1-2 hours'
    };
  }
}
