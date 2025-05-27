/**
 * Tab categorization manager
 * Handles smart categorization logic with custom rules support
 */

import { 
    CATEGORIES, 
    CATEGORY_RULES, 
    LIMITS,
    STORAGE_KEYS 
  } from '../../shared/constants/AppConstants.js';
  import debugUtils from '../../shared/utils/DebugUtils.js';
  import StorageManager from './StorageManager.js';
  
  class CategoryManager {
    constructor() {
      this.customRules = {};
      this.mergedRules = {};
      this.initialized = false;
      
      this.init();
    }
  
    /**
     * Initialize category manager
     */
    async init() {
      try {
        debugUtils.info('Initializing CategoryManager', 'CategoryManager');
        
        await this.loadCustomRules();
        this.mergeRules();
        
        this.initialized = true;
        debugUtils.info('CategoryManager initialized successfully', 'CategoryManager');
      } catch (error) {
        debugUtils.error('Failed to initialize CategoryManager', 'CategoryManager', error);
        throw error;
      }
    }
  
    /**
     * Load custom categorization rules from storage
     */
    async loadCustomRules() {
      try {
        this.customRules = await StorageManager.getCategoryRules();
        debugUtils.debug('Loaded custom rules', 'CategoryManager', this.customRules);
      } catch (error) {
        debugUtils.error('Failed to load custom rules', 'CategoryManager', error);
        this.customRules = {};
      }
    }
  
    /**
     * Merge default and custom rules
     */
    mergeRules() {
      this.mergedRules = { ...CATEGORY_RULES };
      
      // Merge custom rules with default rules
      Object.entries(this.customRules).forEach(([category, custom]) => {
        if (!this.mergedRules[category]) {
          this.mergedRules[category] = { 
            domains: [], 
            keywords: [], 
            weight: 0.6 
          };
        }
        
        this.mergedRules[category] = {
          ...this.mergedRules[category],
          domains: [
            ...(this.mergedRules[category].domains || []),
            ...(custom.domains || [])
          ],
          keywords: [
            ...(this.mergedRules[category].keywords || []),
            ...(custom.keywords || [])
          ]
        };
      });
      
      debugUtils.debug('Merged categorization rules', 'CategoryManager', this.mergedRules);
    }
  
    /**
     * Categorize a single tab
     */
    async categorizeTab(tab) {
      if (!this.initialized) {
        await this.init();
      }
  
      try {
        // Return existing category if manually set
        if (tab.category && tab.category !== CATEGORIES.OTHER) {
          return tab.category;
        }
  
        // Skip categorization for invalid tabs
        if (!tab.url || !tab.title) {
          return CATEGORIES.OTHER;
        }
  
        const category = this.calculateCategory(tab);
        debugUtils.debug(`Categorized tab: ${tab.title} -> ${category}`, 'CategoryManager');
        
        return category;
      } catch (error) {
        debugUtils.error('Failed to categorize tab', 'CategoryManager', error);
        return CATEGORIES.OTHER;
      }
    }
  
    /**
     * Calculate category based on URL and title analysis
     */
    calculateCategory(tab) {
      const url = tab.url.toLowerCase();
      const title = tab.title.toLowerCase();
      
      let hostname;
      try {
        hostname = new URL(tab.url).hostname.toLowerCase();
      } catch {
        return CATEGORIES.OTHER;
      }
  
      let maxScore = 0;
      let bestCategory = CATEGORIES.OTHER;
  
      // Analyze each category
      Object.entries(this.mergedRules).forEach(([category, rules]) => {
        const score = this.calculateCategoryScore(
          hostname, 
          url, 
          title, 
          rules, 
          tab
        );
  
        if (score > maxScore) {
          maxScore = score;
          bestCategory = category;
        }
      });
  
      // Only return category if score exceeds threshold
      return maxScore > LIMITS.MIN_SCORE_THRESHOLD ? bestCategory : CATEGORIES.OTHER;
    }
  
    /**
     * Calculate score for a specific category
     */
    calculateCategoryScore(hostname, url, title, rules, tab) {
      let score = 0;
  
      // Domain matching (strong indicator)
      const domainMatch = rules.domains?.some(domain => 
        hostname.includes(domain.toLowerCase())
      );
      if (domainMatch) {
        score += rules.weight * 2;
      }
  
      // Keyword matching in URL and title
      const keywordMatches = rules.keywords?.filter(keyword => {
        const lowerKeyword = keyword.toLowerCase();
        return url.includes(lowerKeyword) || title.includes(lowerKeyword);
      }).length || 0;
      
      if (keywordMatches > 0) {
        score += (keywordMatches / LIMITS.KEYWORD_THRESHOLD) * rules.weight;
      }
  
      // Boost for frequently accessed tabs
      if (tab.accessCount && tab.accessCount > 3) {
        score += 0.2;
      }
  
      // Boost for recently accessed tabs
      if (tab.lastAccessed && Date.now() - tab.lastAccessed < 3600000) { // 1 hour
        score += 0.1;
      }
  
      return score;
    }
  
    /**
     * Categorize multiple tabs efficiently
     */
    async categorizeTabs(tabs) {
      if (!this.initialized) {
        await this.init();
      }
  
      try {
        const startTime = debugUtils.startTimer('Categorize Tabs');
        
        const categorizedTabs = await Promise.all(
          tabs.map(async tab => ({
            ...tab,
            category: await this.categorizeTab(tab)
          }))
        );
  
        debugUtils.endTimer('Categorize Tabs', startTime);
        debugUtils.info(`Categorized ${tabs.length} tabs`, 'CategoryManager');
        
        return categorizedTabs;
      } catch (error) {
        debugUtils.error('Failed to categorize tabs', 'CategoryManager', error);
        return tabs.map(tab => ({ ...tab, category: CATEGORIES.OTHER }));
      }
    }
  
    /**
     * Get category statistics
     */
    getCategoryStats(tabs) {
      const stats = {};
      
      tabs.forEach(tab => {
        const category = tab.category || CATEGORIES.OTHER;
        stats[category] = (stats[category] || 0) + 1;
      });
  
      return stats;
    }
  
    /**
     * Add custom categorization rule
     */
    async addCustomRule(category, value, type = 'auto') {
      try {
        if (!Object.values(CATEGORIES).includes(category)) {
          throw new Error(`Invalid category: ${category}`);
        }
  
        if (!value || typeof value !== 'string') {
          throw new Error('Value must be a non-empty string');
        }
  
        // Determine rule type if not specified
        if (type === 'auto') {
          type = value.includes('.') ? 'domain' : 'keyword';
        }
  
        // Initialize category rules if not exists
        if (!this.customRules[category]) {
          this.customRules[category] = { domains: [], keywords: [] };
        }
  
        const ruleArray = type === 'domain' ? 'domains' : 'keywords';
        const cleanValue = value.toLowerCase().trim();
  
        // Check if rule already exists
        if (this.customRules[category][ruleArray].includes(cleanValue)) {
          debugUtils.warn(`Rule already exists: ${category} - ${cleanValue}`, 'CategoryManager');
          return false;
        }
  
        // Check limits
        const totalRules = Object.values(this.customRules).reduce((total, rules) => 
          total + (rules.domains?.length || 0) + (rules.keywords?.length || 0), 0
        );
  
        if (totalRules >= LIMITS.MAX_CUSTOM_RULES) {
          throw new Error(`Maximum custom rules limit (${LIMITS.MAX_CUSTOM_RULES}) reached`);
        }
  
        // Add the rule
        this.customRules[category][ruleArray].push(cleanValue);
  
        // Save to storage and update merged rules
        await StorageManager.setCategoryRules(this.customRules);
        this.mergeRules();
  
        debugUtils.info(`Added custom rule: ${category} - ${cleanValue} (${type})`, 'CategoryManager');
        return true;
      } catch (error) {
        debugUtils.error('Failed to add custom rule', 'CategoryManager', error);
        throw error;
      }
    }
  
    /**
     * Remove custom categorization rule
     */
    async removeCustomRule(category, value, type = 'auto') {
      try {
        if (!this.customRules[category]) {
          return false;
        }
  
        // Determine rule type if not specified
        if (type === 'auto') {
          type = value.includes('.') ? 'domain' : 'keyword';
        }
  
        const ruleArray = type === 'domain' ? 'domains' : 'keywords';
        const cleanValue = value.toLowerCase().trim();
  
        // Remove the rule
        const rules = this.customRules[category][ruleArray];
        const index = rules.indexOf(cleanValue);
        
        if (index === -1) {
          return false;
        }
  
        rules.splice(index, 1);
  
        // Clean up empty categories
        if (rules.length === 0 && 
            this.customRules[category].domains.length === 0 && 
            this.customRules[category].keywords.length === 0) {
          delete this.customRules[category];
        }
  
        // Save to storage and update merged rules
        await StorageManager.setCategoryRules(this.customRules);
        this.mergeRules();
  
        debugUtils.info(`Removed custom rule: ${category} - ${cleanValue} (${type})`, 'CategoryManager');
        return true;
      } catch (error) {
        debugUtils.error('Failed to remove custom rule', 'CategoryManager', error);
        throw error;
      }
    }
  
    /**
     * Get all custom rules
     */
    getCustomRules() {
      return { ...this.customRules };
    }
  
    /**
     * Clear all custom rules
     */
    async clearCustomRules() {
      try {
        this.customRules = {};
        await StorageManager.setCategoryRules({});
        this.mergeRules();
        
        debugUtils.info('Cleared all custom rules', 'CategoryManager');
      } catch (error) {
        debugUtils.error('Failed to clear custom rules', 'CategoryManager', error);
        throw error;
      }
    }
  
    /**
     * Suggest category for a URL
     */
    suggestCategory(url, title = '') {
      try {
        const mockTab = { url, title, accessCount: 0 };
        return this.calculateCategory(mockTab);
      } catch (error) {
        debugUtils.error('Failed to suggest category', 'CategoryManager', error);
        return CATEGORIES.OTHER;
      }
    }
  
    /**
     * Get category performance metrics
     */
    getCategoryMetrics(tabs) {
      const metrics = {
        total: tabs.length,
        categorized: 0,
        uncategorized: 0,
        categories: {},
        accuracy: 0
      };
  
      tabs.forEach(tab => {
        const category = tab.category || CATEGORIES.OTHER;
        
        if (!metrics.categories[category]) {
          metrics.categories[category] = {
            count: 0,
            percentage: 0,
            avgAccessCount: 0,
            totalAccessCount: 0
          };
        }
  
        metrics.categories[category].count++;
        metrics.categories[category].totalAccessCount += tab.accessCount || 0;
  
        if (category !== CATEGORIES.OTHER) {
          metrics.categorized++;
        } else {
          metrics.uncategorized++;
        }
      });
  
      // Calculate percentages and averages
      Object.values(metrics.categories).forEach(categoryStats => {
        categoryStats.percentage = Math.round(
          (categoryStats.count / metrics.total) * 100
        );
        categoryStats.avgAccessCount = categoryStats.count > 0 
          ? Math.round(categoryStats.totalAccessCount / categoryStats.count)
          : 0;
      });
  
      metrics.accuracy = Math.round((metrics.categorized / metrics.total) * 100);
  
      return metrics;
    }
  
    /**
     * Refresh categorization rules
     */
    async refresh() {
      try {
        await this.loadCustomRules();
        this.mergeRules();
        debugUtils.info('Category rules refreshed', 'CategoryManager');
      } catch (error) {
        debugUtils.error('Failed to refresh category rules', 'CategoryManager', error);
        throw error;
      }
    }
  }
  
  // Create singleton instance
  export default new CategoryManager();