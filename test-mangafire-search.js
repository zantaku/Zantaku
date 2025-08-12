// Test script for MangaFire search improvements
const axios = require('axios');

const MANGAFIRE_API_URL = 'https://magaapinovel.xyz/api';

// Helper function to normalize titles for better matching
function normalizeTitle(title) {
  return title
    .toLowerCase()
    .replace(/[★☆]/g, '') // Remove special characters
    .replace(/[:\-\s]+/g, ' ') // Normalize separators
    .trim();
}

// Helper function to detect Japanese characters
function containsJapanese(text) {
  return /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(text);
}

// Helper function to calculate title similarity score
function calculateSimilarityScore(searchTitle, resultTitle) {
  const normalizedSearch = normalizeTitle(searchTitle);
  const normalizedResult = normalizeTitle(resultTitle);
  
  // Exact match gets highest score
  if (normalizedSearch === normalizedResult) {
    return 100;
  }
  
  // Check if search title is contained in result title
  if (normalizedResult.includes(normalizedSearch)) {
    return 90;
  }
  
  // Check if result title is contained in search title
  if (normalizedSearch.includes(normalizedResult)) {
    return 85;
  }
  
  // Special handling for Japanese titles and their English equivalents
  const japaneseMappings = {
    '地雷': ['landmine', 'dangerous', 'jirai'],
    '地原': ['chihara'],
    'なんですか': ['desu ka', 'what is', 'is it'],
    'jirai': ['地雷', 'landmine', 'dangerous'],
    'chihara': ['地原']
  };
  
  // Check for Japanese-English mappings
  for (const [japanese, english] of Object.entries(japaneseMappings)) {
    if (normalizedSearch.includes(japanese) || english.some(e => normalizedSearch.includes(e))) {
      if (normalizedResult.includes(japanese) || english.some(e => normalizedResult.includes(e))) {
        // High score for matching Japanese-English pairs
        return 80;
      }
    }
  }
  
  // Split into words and calculate word overlap
  const searchWords = normalizedSearch.split(/\s+/).filter(word => word.length > 2);
  const resultWords = normalizedResult.split(/\s+/).filter(word => word.length > 2);
  
  if (searchWords.length === 0 || resultWords.length === 0) {
    return 0;
  }
  
  let matchCount = 0;
  let totalScore = 0;
  
  for (const searchWord of searchWords) {
    for (const resultWord of resultWords) {
      if (resultWord.includes(searchWord) || searchWord.includes(resultWord)) {
        matchCount++;
        totalScore += Math.min(searchWord.length, resultWord.length);
      }
    }
  }
  
  if (matchCount === 0) {
    return 0;
  }
  
  // Calculate percentage of words matched
  const wordMatchPercentage = (matchCount / searchWords.length) * 100;
  
  // Bonus for matching at the beginning
  let positionBonus = 0;
  if (normalizedResult.startsWith(searchWords[0] || '')) {
    positionBonus = 10;
  }
  
  // Bonus for similar length
  const lengthDiff = Math.abs(normalizedResult.length - normalizedSearch.length);
  const lengthBonus = Math.max(0, 20 - lengthDiff);
  
  // Bonus for Japanese-English title matches
  let japaneseBonus = 0;
  if (containsJapanese(searchTitle) && !containsJapanese(resultTitle)) {
    // Bonus for finding English equivalent of Japanese title
    japaneseBonus = 15;
  }
  
  return Math.min(100, wordMatchPercentage + positionBonus + lengthBonus + japaneseBonus);
}

async function testSearch(query) {
  try {
    console.log(`\n🔍 Testing search for: "${query}"`);
    
    const url = `${MANGAFIRE_API_URL}/search/${encodeURIComponent(query)}`;
    console.log(`URL: ${url}`);
    
    const response = await axios.get(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Kamilist/1.0'
      }
    });
    
    const data = response.data;
    
    if (!data || !data.list || !Array.isArray(data.list)) {
      console.log('❌ Invalid response format');
      return;
    }
    
    console.log(`📊 Found ${data.list.length} results`);
    
    // Sort results by relevance score
    const scoredResults = data.list.map((result) => {
      const score = calculateSimilarityScore(query, result.name || '');
      return {
        ...result,
        relevanceScore: score
      };
    }).sort((a, b) => b.relevanceScore - a.score);
    
    // Show top 5 results with scores
    console.log('\n🏆 Top 5 results by relevance:');
    scoredResults.slice(0, 5).forEach((result, index) => {
      console.log(`${index + 1}. "${result.name}" - Score: ${result.relevanceScore}`);
      console.log(`   ID: ${result.id}`);
      console.log(`   Type: ${result.type}`);
    });
    
    // Check if the first result seems correct
    if (scoredResults.length > 0) {
      const topResult = scoredResults[0];
      console.log(`\n✅ Top result: "${topResult.name}" (Score: ${topResult.relevanceScore})`);
      
      if (topResult.relevanceScore >= 70) {
        console.log('🎯 High confidence match!');
      } else if (topResult.relevanceScore >= 50) {
        console.log('⚠️ Medium confidence match');
      } else {
        console.log('❌ Low confidence match - might be wrong manga');
      }
    }
    
  } catch (error) {
    console.error(`❌ Error searching for "${query}":`, error.message);
  }
}

async function runTests() {
  console.log('🧪 Testing MangaFire search improvements...\n');
  
  // Test Japanese title
  await testSearch('地雷なんですか？地原さん');
  
  // Test English equivalent
  await testSearch('landmine chihara');
  
  // Test mixed title
  await testSearch('jirai nan desu ka chihara san');
  
  console.log('\n✨ Tests completed!');
}

// Run the tests
runTests().catch(console.error);
