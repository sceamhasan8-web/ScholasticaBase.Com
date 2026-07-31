/**
 * schoolResolver.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Pure utility functions for resolving institution (branch) names from class
 * names in the three-branch school management system.
 *
 * Default Branch Map:
 *   Primary   → Primary School (Nursery, One–Five / 1–5)
 *   Secondary → High School (Six–Ten / 6–10)
 *   College   → College (Eleven–Twelve / 11–12)
 * ─────────────────────────────────────────────────────────────────────────────
 */

export const DEFAULT_BRANCH_NAMES = {
  primary: 'Primary School',
  secondary: 'High School',
  college: 'College',
};

/**
 * Reads custom branch names saved in localStorage if available.
 */
export function getCustomBranchNames() {
  try {
    if (typeof window !== 'undefined') {
      const storedBranches = window.localStorage.getItem('schoolBranchNames');
      if (storedBranches) {
        return JSON.parse(storedBranches);
      }
      const profileRaw = window.localStorage.getItem('schoolAppProfile');
      if (profileRaw) {
        const parsed = JSON.parse(profileRaw);
        if (parsed?.branchNames) {
          return parsed.branchNames;
        }
      }
    }
  } catch {
    // Fallback if localStorage read fails
  }
  return null;
}

const BASE_SCHOOL_BRANCHES = {
  primary: {
    key: 'primary',
    defaultName: 'Primary School',
    emoji: '🏫',
    color: '#16a34a',
    gradientFrom: '#166534',
    gradientTo: '#15803d',
    classes: ['Nursery', 'Class One', 'Class Two', 'Class Three', 'Class Four', 'Class Five'],
  },
  secondary: {
    key: 'secondary',
    defaultName: 'High School',
    emoji: '🎓',
    color: '#2563eb',
    gradientFrom: '#1e3a8a',
    gradientTo: '#1d4ed8',
    classes: ['Class Six', 'Class Seven', 'Class Eight', 'Class Nine', 'Class Ten'],
  },
  college: {
    key: 'college',
    defaultName: 'College',
    emoji: '🏛️',
    color: '#7c3aed',
    gradientFrom: '#4c1d95',
    gradientTo: '#6d28d9',
    classes: ['Class Eleven', 'Class Twelve'],
  },
};

/**
 * Returns complete branch definitions resolved with custom branch titles if provided.
 * @param {object} [customSource] - Optional schoolProfile or branchNames object
 */
export function getResolvedBranches(customSource) {
  const custom =
    customSource?.branchNames ||
    (customSource && typeof customSource === 'object' && !customSource.name ? customSource : null) ||
    getCustomBranchNames() ||
    {};

  return {
    primary: {
      ...BASE_SCHOOL_BRANCHES.primary,
      name: custom.primary || BASE_SCHOOL_BRANCHES.primary.defaultName,
      shortName: custom.primary || BASE_SCHOOL_BRANCHES.primary.defaultName,
    },
    secondary: {
      ...BASE_SCHOOL_BRANCHES.secondary,
      name: custom.secondary || BASE_SCHOOL_BRANCHES.secondary.defaultName,
      shortName: custom.secondary || BASE_SCHOOL_BRANCHES.secondary.defaultName,
    },
    college: {
      ...BASE_SCHOOL_BRANCHES.college,
      name: custom.college || BASE_SCHOOL_BRANCHES.college.defaultName,
      shortName: custom.college || BASE_SCHOOL_BRANCHES.college.defaultName,
    },
  };
}

function createBranchProxy(key, base) {
  return {
    ...base,
    get name() {
      const custom = getCustomBranchNames();
      return custom && custom[key] ? custom[key] : base.defaultName;
    },
    get shortName() {
      const custom = getCustomBranchNames();
      return custom && custom[key] ? custom[key] : base.defaultName;
    },
  };
}

export const SCHOOL_BRANCHES = {
  primary: createBranchProxy('primary', BASE_SCHOOL_BRANCHES.primary),
  secondary: createBranchProxy('secondary', BASE_SCHOOL_BRANCHES.secondary),
  college: createBranchProxy('college', BASE_SCHOOL_BRANCHES.college),
};

/**
 * Normalizes Bengali digits to standard ASCII digits.
 * e.g., "১০ম" -> "10ম", "শ্রেণি ৫" -> "শ্রেণি 5"
 */
export function normalizeBengaliDigits(str) {
  if (!str) return '';
  const banglaDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
  return String(str).replace(/[০-৯]/g, (m) => banglaDigits.indexOf(m));
}

/**
 * Extracts numeric class level from string (e.g. "Class 5", "৫ম শ্রেণি", "10", "১১দশ").
 * Returns an integer number or null if no valid class number is found.
 */
export function extractClassNumber(className) {
  if (!className) return null;
  const normalized = normalizeBengaliDigits(String(className));
  const match = normalized.match(/\b(1[0-2]|[0-9])\b/) || normalized.match(/(1[0-2]|[0-9])/);
  if (match) {
    const num = parseInt(match[1], 10);
    if (!isNaN(num)) return num;
  }
  const sortIndex = getClassSortIndex(className);
  if (sortIndex >= 100 && sortIndex <= 1200) {
    return Math.floor(sortIndex / 100);
  }
  return null;
}

/**
 * Intelligent Class Name Analyzer / Parser.
 * Maps any class name (words, digits, bangla, ordinals, early childhood)
 * to a precise hierarchical numeric sort index.
 * 
 * @param {string} className
 * @returns {number}
 */
export function getClassSortIndex(className) {
  if (!className) return 99999;

  const rawOriginal = String(className).trim();
  const raw = normalizeBengaliDigits(rawOriginal).toLowerCase();

  const hasKw = (kw) => raw.includes(kw);

  // 1. Early Childhood / Pre-Primary Grades
  if (hasKw('play') || hasKw('প্লে') || hasKw('শিশু')) return 10;
  if (hasKw('nursery') || hasKw('infant') || hasKw('নাসারি') || hasKw('নার্সারি')) return 20;
  if (hasKw('pre-primary') || hasKw('preprimary') || hasKw('lkg') || hasKw('প্রাক-প্রাথমিক') || hasKw('প্রাক প্রাথমিক')) return 30;
  if (hasKw('kg') || hasKw('ukg') || hasKw('kindergarten') || hasKw('কেজি')) return 40;

  // 2. High Priority Keyword Checks for Standard Grades (English words, Ordinals, Bangla)
  if (hasKw('twelve') || hasKw('twelfth') || hasKw('12th') || hasKw('12-th') || hasKw('hsc 2') || hasKw('2nd year') || hasKw('দ্বাদশ') || hasKw('১২তম') || hasKw('বারো')) return 1200;
  if (hasKw('eleven') || hasKw('eleventh') || hasKw('11th') || hasKw('11-th') || hasKw('hsc 1') || hasKw('1st year') || hasKw('একাদশ') || hasKw('১১তম') || hasKw('এগারো')) return 1100;
  if (hasKw('ten') || hasKw('tenth') || hasKw('10th') || hasKw('10-th') || hasKw('ssc') || hasKw('দশম') || hasKw('১০তম') || hasKw('দশ')) return 1000;
  if (hasKw('nine') || hasKw('ninth') || hasKw('9th') || hasKw('9-th') || hasKw('নবম') || hasKw('৯তম') || hasKw('নয়') || hasKw('নয়')) return 900;
  if (hasKw('eight') || hasKw('eighth') || hasKw('8th') || hasKw('8-th') || hasKw('অষ্টম') || hasKw('৮তম') || hasKw('আট')) return 800;
  if (hasKw('seven') || hasKw('seventh') || hasKw('7th') || hasKw('7-th') || hasKw('সপ্তম') || hasKw('৭তম') || hasKw('সাত')) return 700;
  if (hasKw('six') || hasKw('sixth') || hasKw('6th') || hasKw('6-th') || hasKw('ষষ্ঠ') || hasKw('৬তম') || hasKw('ছয়') || hasKw('ছয়')) return 600;
  if (hasKw('five') || hasKw('fifth') || hasKw('5th') || hasKw('5-th') || hasKw('পঞ্চম') || hasKw('৫তম') || hasKw('পাঁচ')) return 500;
  if (hasKw('four') || hasKw('fourth') || hasKw('4th') || hasKw('4-th') || hasKw('চতুর্থ') || hasKw('৪তম') || hasKw('চার')) return 400;
  if (hasKw('three') || hasKw('third') || hasKw('3rd') || hasKw('3-rd') || hasKw('তৃতীয়') || hasKw('৩তম') || hasKw('তিন')) return 300;
  if (hasKw('two') || hasKw('second') || hasKw('2nd') || hasKw('2-nd') || hasKw('দ্বিতীয়') || hasKw('২তম') || hasKw('দুই')) return 200;
  if (hasKw('one') || hasKw('first') || hasKw('1st') || hasKw('1-st') || hasKw('প্রথম') || hasKw('১তম') || hasKw('এক')) return 100;

  // 3. Fallback extraction of embedded digits
  const numMatch = raw.match(/\b(\d+)\b/) || raw.match(/(\d+)/);
  if (numMatch) {
    const val = parseInt(numMatch[1], 10);
    if (!isNaN(val)) return val * 100;
  }

  return 99999;
}

/**
 * Sorts an array of class items (strings or objects)
 * in strict chronological school grade order based on getClassSortIndex.
 *
 * @param {Array} classArray
 * @param {string|function} [keyOrExtractor]
 * @returns {Array}
 */
export function sortClasses(classArray, keyOrExtractor) {
  if (!Array.isArray(classArray) || classArray.length <= 1) return classArray || [];

  return [...classArray].sort((a, b) => {
    let nameA = '';
    let nameB = '';

    if (typeof keyOrExtractor === 'function') {
      nameA = keyOrExtractor(a);
      nameB = keyOrExtractor(b);
    } else if (typeof keyOrExtractor === 'string') {
      nameA = a?.[keyOrExtractor];
      nameB = b?.[keyOrExtractor];
    } else if (typeof a === 'string') {
      nameA = a;
      nameB = b;
    } else if (typeof a === 'object' && a !== null) {
      nameA = a.className || a.name || a.class || a.label || a.title || '';
      nameB = b.className || b.name || b.class || b.label || b.title || '';
    }

    const indexA = getClassSortIndex(nameA);
    const indexB = getClassSortIndex(nameB);

    if (indexA !== indexB) {
      return indexA - indexB;
    }

    return String(nameA).localeCompare(String(nameB), undefined, { numeric: true, sensitivity: 'base' });
  });
}

/**
 * Normalises a raw class name string and returns the exact branch key:
 *   - 'primary'   : Class 1 to Class 5 (and Nursery, Play, KG, Pre-Primary)
 *   - 'secondary' : Class 6 to Class 10
 *   - 'college'   : Class 11 to Class 12 (and Inter, HSC, College)
 *
 * @param {string|object} className
 * @returns {'primary'|'secondary'|'college'}
 */
export function getBranchKeyByClass(className) {
  if (!className) return 'primary';

  // If passed a class object, check explicit branch properties first
  if (typeof className === 'object' && className !== null) {
    const explicitBranch = className.branchKey || className.branchId || className.branch || className.sectionId;
    if (explicitBranch) {
      const lowerKey = String(explicitBranch).toLowerCase().trim();
      if (['primary', 'secondary', 'college'].includes(lowerKey)) {
        return lowerKey;
      }
    }
    className = className.className || className.name || className.class || className.label || '';
  }

  const rawOriginal = String(className).trim();
  if (!rawOriginal) return 'primary';
  const raw = normalizeBengaliDigits(rawOriginal).toLowerCase();

  // 1. Keyword checks for College (11–12 & HSC/Inter) FIRST
  const collegeKeywords = [
    'inter', 'hsc', 'college', 'eleven', 'twelve', '11th', '12th', 'class 11', 'class 12',
    'first year', 'second year', '1st year', '2nd year', 'একাদশ', 'দ্বাদশ', '১১শ', '১১তম', 'এগারো',
    '১২শ', '১২তম', 'বারো', 'ইন্টার', 'এইচএসসি', 'কলেজ', 'উচ্চ মাধ্যমিক', 'xi', 'xii'
  ];
  if (collegeKeywords.some((kw) => kw && raw.includes(kw))) return 'college';

  // 2. Check numeric class level if present (1-5 -> primary, 6-10 -> secondary, 11-12 -> college)
  const classNum = extractClassNumber(rawOriginal);
  if (classNum !== null) {
    if (classNum >= 0 && classNum <= 5) return 'primary';
    if (classNum >= 6 && classNum <= 10) return 'secondary';
    if (classNum >= 11 && classNum <= 12) return 'college';
  }

  // 3. Keyword checks for Secondary (6–10)
  const secondaryKeywords = [
    'class six', 'six', 'class 6', 'ষষ্ঠ', '৬ষ্ঠ', 'ছয়',
    'class seven', 'seven', 'class 7', 'সপ্তম', '৭ম', 'সাত',
    'class eight', 'eight', 'class 8', 'অষ্টম', '৮ম', 'আট',
    'class nine', 'nine', 'class 9', 'নবম', '৯ম', 'নয়',
    'class ten', 'ten', 'class 10', 'দশম', '১০ম', 'দশ',
    'secondary', 'high school', 'মাধ্যমিক', 'হাইস্কুল'
  ];
  if (secondaryKeywords.some((kw) => raw.includes(kw))) return 'secondary';

  // 4. Keyword checks for Primary (1–5 & early childhood)
  const primaryKeywords = [
    'nursery', 'play', 'kg', 'kindergarten', 'infant', 'pre-primary', 'নাসারি', 'প্লে', 'কেজি', 'শিশু',
    'class one', 'one', 'class 1', 'প্রথম', '১ম', 'এক',
    'class two', 'two', 'class 2', 'দ্বিতীয়', '২য়', 'দুই',
    'class three', 'three', 'class 3', 'তৃতীয়', '৩য়', 'তিন',
    'class four', 'four', 'class 4', 'চতুর্থ', '৪র্থ', 'চার',
    'class five', 'five', 'class 5', 'পঞ্চম', '৫ম', 'পাঁচ',
    'primary', 'প্রাথমিক'
  ];
  if (primaryKeywords.some((kw) => raw.includes(kw))) return 'primary';

  return 'primary';
}

export function getSchoolNameByClass(className, customSource) {
  const key = getBranchKeyByClass(className);
  if (!key) return '';
  const resolved = customSource ? getResolvedBranches(customSource) : SCHOOL_BRANCHES;
  return resolved[key]?.name || '';
}

/**
 * Returns the branch object for a given class name.
 *
 * @param {string} className
 * @param {object} [customSource]
 * @returns {object|null}
 */
export function getBranchByClass(className, customSource) {
  const key = getBranchKeyByClass(className);
  if (!key) return null;
  const resolved = customSource ? getResolvedBranches(customSource) : SCHOOL_BRANCHES;
  return resolved[key] || null;
}

/**
 * Filters an array of class objects to only include classes belonging to a
 * specific branch key and automatically sorts them in chronological order.
 *
 * @param {Array<{className: string}>} classArray
 * @param {'primary'|'secondary'|'college'} branchKey
 * @returns {Array}
 */
export function filterClassesByBranch(classArray, branchKey) {
  if (!Array.isArray(classArray) || !branchKey) return classArray || [];
  return classArray.filter((cls) => getBranchKeyByClass(cls.className) === branchKey);
}
