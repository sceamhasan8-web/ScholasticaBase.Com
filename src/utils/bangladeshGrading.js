export const BANGLADESH_GRADE_SCALE = [
    { min: 80, max: 100, grade: 'A+', gradePoint: 5.0, remarks: 'Outstanding', color: '#7c3aed' },
    { min: 70, max: 79, grade: 'A', gradePoint: 4.0, remarks: 'Excellent', color: '#2563eb' },
    { min: 60, max: 69, grade: 'A-', gradePoint: 3.5, remarks: 'Very Good', color: '#0284c7' },
    { min: 50, max: 59, grade: 'B', gradePoint: 3.0, remarks: 'Good', color: '#16a34a' },
    { min: 40, max: 49, grade: 'C', gradePoint: 2.0, remarks: 'Average', color: '#f59e0b' },
    { min: 33, max: 39, grade: 'D', gradePoint: 1.0, remarks: 'Pass', color: '#f97316' },
    { min: 0, max: 32, grade: 'F', gradePoint: 0.0, remarks: 'Fail', color: '#ef4444' },
];

export const getBangladeshGradeInfo = (marks) => {
    const value = Number(marks);
    if (!Number.isFinite(value)) {
        return { grade: '-', gradePoint: 0.0, remarks: 'N/A', status: 'N/A', color: '#6b7280' };
    }

    const clampedValue = Math.max(0, Math.min(100, value));
    const gradeInfo = BANGLADESH_GRADE_SCALE.find((item) => clampedValue >= item.min && clampedValue <= item.max) || BANGLADESH_GRADE_SCALE[BANGLADESH_GRADE_SCALE.length - 1];

    return {
        ...gradeInfo,
        status: gradeInfo.grade === 'F' ? 'Fail' : 'Pass',
    };
};

export const getDynamicGradeInfo = (marks, totalMarks = 100, passMarks = 33) => {
    const value = Number(marks);
    if (!Number.isFinite(value)) {
        return { grade: '-', gradePoint: 0.0, remarks: 'N/A', status: 'N/A', color: '#6b7280' };
    }

    // Force Fail if below pass marks
    if (value < passMarks) {
        return { grade: 'F', gradePoint: 0.0, remarks: 'Fail', status: 'Fail', color: '#ef4444' };
    }

    // Calculate percentage
    const percentage = totalMarks > 0 ? (value / totalMarks) * 100 : 0;
    const clampedPercentage = Math.max(0, Math.min(100, percentage));

    // Find grade using standard Bangladesh grade scale
    const gradeInfo = BANGLADESH_GRADE_SCALE.find((item) => clampedPercentage >= item.min && clampedPercentage <= item.max) || BANGLADESH_GRADE_SCALE[BANGLADESH_GRADE_SCALE.length - 1];

    // If gradeInfo finds 'F' but we passed the passMarks check, force 'D' as the lowest pass grade
    if (gradeInfo.grade === 'F') {
        const dGrade = BANGLADESH_GRADE_SCALE.find(item => item.grade === 'D') || gradeInfo;
        return {
            ...dGrade,
            status: 'Pass',
        };
    }

    return {
        ...gradeInfo,
        status: 'Pass',
    };
};

/**
 * getDynamicGradeInfoWithComponents
 *
 * Evaluates a subject result that may have separate CQ and MCQ components.
 *
 * When the rule carries CQ/MCQ fields (cqTotal, cqPass, mcqTotal, mcqPass):
 *   - If the subject has MCQ disabled (rule.hasMcq === false), only the CQ
 *     component is checked and graded.
 *   - If either component is below its pass mark → forced grade F, status Fail.
 *   - If both components pass → grade computed from combined percentage.
 *
 * When the rule only carries the legacy fields (totalMarks, passMarks) OR
 * when cqMarks / mcqMarks are not finite numbers (old saved data), it falls
 * back transparently to getDynamicGradeInfo().
 *
 * @param {number|string} cqMarks   - Marks obtained in the CQ component
 * @param {number|string} mcqMarks  - Marks obtained in the MCQ component (ignored when hasMcq=false)
 * @param {object}        rule      - Subject rule object from examSession.subjectRules
 * @returns {object} Grade info: { grade, gradePoint, status, remarks, color, componentStatus }
 */
export const getDynamicGradeInfoWithComponents = (cqMarks, mcqMarks, rule = {}) => {
    const hasCqMcqRule =
        Number.isFinite(Number(rule.cqTotal)) &&
        Number.isFinite(Number(rule.cqPass));

    // ── Legacy fallback: rule has no CQ/MCQ fields ──────────────────────────
    if (!hasCqMcqRule) {
        const total = Number(cqMarks) + (Number.isFinite(Number(mcqMarks)) ? Number(mcqMarks) : 0);
        return getDynamicGradeInfo(total, rule.totalMarks ?? 100, rule.passMarks ?? 33);
    }

    const cq = Number(cqMarks);
    const mcq = Number(mcqMarks);

    const cqTotal = Number(rule.cqTotal);
    const cqPass = Number(rule.cqPass);
    const mcqTotal = Number(rule.mcqTotal ?? 0);
    const mcqPass = Number(rule.mcqPass ?? 0);
    const hasMcq = rule.hasMcq !== false && mcqTotal > 0;

    // Validate inputs
    if (!Number.isFinite(cq)) {
        return { grade: '-', gradePoint: 0.0, remarks: 'N/A', status: 'N/A', color: '#6b7280', componentStatus: {} };
    }

    // ── Component-level pass checks ──────────────────────────────────────────
    const cqFail = cq < cqPass;
    const mcqFail = hasMcq && Number.isFinite(mcq) && mcq < mcqPass;

    const componentStatus = {
        cqMarks: cq,
        cqTotal,
        cqPass,
        cqStatus: cqFail ? 'Fail' : 'Pass',
        ...(hasMcq ? {
            mcqMarks: mcq,
            mcqTotal,
            mcqPass,
            mcqStatus: mcqFail ? 'Fail' : 'Pass',
        } : {}),
    };

    if (cqFail || mcqFail) {
        return {
            grade: 'F',
            gradePoint: 0.0,
            remarks: 'Fail',
            status: 'Fail',
            color: '#ef4444',
            componentStatus,
            failReason: cqFail && mcqFail ? 'Both CQ and MCQ failed'
                : cqFail ? 'CQ failed'
                    : 'MCQ failed',
        };
    }

    // ── Both components passed → compute combined percentage grade ───────────
    const combinedMarks = cq + (hasMcq && Number.isFinite(mcq) ? mcq : 0);
    const combinedTotal = cqTotal + (hasMcq ? mcqTotal : 0);
    const percentage = combinedTotal > 0 ? (combinedMarks / combinedTotal) * 100 : 0;
    const clamped = Math.max(0, Math.min(100, percentage));

    const gradeInfo = BANGLADESH_GRADE_SCALE.find(
        (item) => clamped >= item.min && clamped <= item.max
    ) || BANGLADESH_GRADE_SCALE[BANGLADESH_GRADE_SCALE.length - 1];

    // Edge case: if percentage lands in F band but both components passed, bump to D
    if (gradeInfo.grade === 'F') {
        const dGrade = BANGLADESH_GRADE_SCALE.find(item => item.grade === 'D') || gradeInfo;
        return { ...dGrade, status: 'Pass', componentStatus };
    }

    return { ...gradeInfo, status: 'Pass', componentStatus };
};

/**
 * Helper: resolve the effective total / pass marks from a rule object,
 * regardless of whether it uses the CQ/MCQ or the legacy shape.
 */
export const resolveRuleTotals = (rule = {}) => {
    if (Number.isFinite(Number(rule.cqTotal))) {
        const hasMcq = rule.hasMcq !== false && Number(rule.mcqTotal) > 0;
        return {
            totalMarks: Number(rule.cqTotal) + (hasMcq ? Number(rule.mcqTotal) : 0),
            passMarks: Number(rule.cqPass) + (hasMcq ? Number(rule.mcqPass) : 0),
            hasCqMcq: true,
            hasMcq,
        };
    }
    return {
        totalMarks: rule.totalMarks ?? 100,
        passMarks: rule.passMarks ?? 33,
        hasCqMcq: false,
        hasMcq: false,
    };
};

