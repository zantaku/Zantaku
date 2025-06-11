import axios from 'axios';
import { XMLParser } from 'fast-xml-parser';
import { NewsItem } from './ANN';

export class SoraNews24Provider {
  private static readonly BASE_URL = 'https://soranews24.com/feed/';
  
  static async fetchNews(maxItems: number = 10): Promise<NewsItem[]> {
    try {
      console.log('🔍 Fetching SoraNews24...');
      
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
        // Extract thumbnail from content or description
        let thumbnail = null;
        const content = item['content:encoded'] || item.description || '';
        const imgMatch = content.match(/<img[^>]+src="([^"]+)"/);
        thumbnail = imgMatch ? imgMatch[1] : null;
        
        // Clean up title
        const title = item.title?.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
        
        // Determine category based on content
        let category = 'Japan Culture';
        const titleLower = title?.toLowerCase() || '';
        if (titleLower.includes('anime') || titleLower.includes('manga')) {
          category = 'Anime';
        } else if (titleLower.includes('food') || titleLower.includes('restaurant')) {
          category = 'Lifestyle';
        } else if (titleLower.includes('tech') || titleLower.includes('game')) {
          category = 'Technology';
        }
        
        return {
          id: `soranews24-${Date.now()}-${index}`,
          title: title || 'Untitled',
          source: 'SoraNews24',
          timestamp: new Date(item.pubDate).toISOString(),
          url: item.link || '',
          thumbnail,
          category,
          isInternalLink: false,
          description: content.replace(/<[^>]*>/g, '').substring(0, 200) + '...',
          author: item.creator || 'SoraNews24'
        };
      });

      console.log(`✅ SoraNews24: Fetched ${newsItems.length} news items`);
      return newsItems;
      
    } catch (error) {
      console.error('❌ Error fetching SoraNews24:', error);
      return [];
    }
  }
  
  static isAvailable(): boolean {
    return true;
  }
  
  static getSourceInfo() {
    return {
      name: 'SoraNews24',
      description: 'Fun and quirky news from Japan',
      categories: ['japan-culture', 'lifestyle', 'entertainment', 'food'],
      language: 'en',
      updateFrequency: '2-6 hours'
    };
  }
}
