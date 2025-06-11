import axios from 'axios';
import { XMLParser } from 'fast-xml-parser';
import { NewsItem } from './ANN';

export class CrunchyrollProvider {
  private static readonly BASE_URL = 'https://www.crunchyroll.com/news/rss';
  
  static async fetchNews(maxItems: number = 10): Promise<NewsItem[]> {
    try {
      console.log('🔍 Fetching Crunchyroll news...');
      
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
        // Extract thumbnail from description or media content
        let thumbnail = null;
        if (item.description) {
          const imgMatch = item.description.match(/<img[^>]+src="([^"]+)"/);
          thumbnail = imgMatch ? imgMatch[1] : null;
        }
        
        // Clean up title
        const title = item.title?.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
        
        return {
          id: `crunchyroll-${Date.now()}-${index}`,
          title: title || 'Untitled',
          source: 'Crunchyroll',
          timestamp: new Date(item.pubDate).toISOString(),
          url: item.link || '',
          thumbnail,
          category: 'News',
          isInternalLink: false,
          description: item.description?.replace(/<[^>]*>/g, '').substring(0, 200) + '...',
          author: 'Crunchyroll News'
        };
      });

      console.log(`✅ Crunchyroll: Fetched ${newsItems.length} news items`);
      return newsItems;
      
    } catch (error) {
      console.error('❌ Error fetching Crunchyroll news:', error);
      return [];
    }
  }
  
  static isAvailable(): boolean {
    return true;
  }
  
  static getSourceInfo() {
    return {
      name: 'Crunchyroll News',
      description: 'Official news from Crunchyroll',
      categories: ['anime', 'streaming', 'industry'],
      language: 'en',
      updateFrequency: '2-4 hours'
    };
  }
}
