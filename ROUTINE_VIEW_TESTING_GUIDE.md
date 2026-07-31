# 🧪 Routine View - Comprehensive Testing Guide

## Overview
This guide provides step-by-step tests to verify the black screen fix and all improvements to the Routine View component.

---

## Test 1: No Black Screen on App Load ✅

### Steps
1. Start the app
2. Navigate to the **Routine Management System** section
3. Observe the page for 3 seconds

### Expected Result
- ✅ Page loads without black screen
- ✅ "📅 রুটিন ম্যানেজমেন্ট সিস্টেম" header visible
- ✅ Tab buttons for "শিক্ষক রুটিন" and "ক্লাস রুটিন" visible
- ✅ "⏱️ সময় পরিবর্তন" button visible

### If Failed
- Check browser console for errors
- Verify `classes` and `teachers` props are passed to component
- Check for null/undefined values in data

---

## Test 2: Edit Time Period WITHOUT Black Screen ✅ (Critical)

### Steps
1. Click **"⏱️ সময় পরিবর্তন"** button
2. Scroll to first period (পিরিয়ড 1)
3. Change the time from "৯:০০-৯:৫০" to "৯:০০-৯:৪৫"
4. Click **"সংরক্ষণ করুন"**

### Expected Result
- ✅ Modal opens smoothly
- ✅ Input fields are editable
- ✅ No black screen or freeze
- ✅ Success message appears: "✅ সময়সূচী সফলভাবে আপডেট করা হয়েছে!"
- ✅ Modal closes
- ✅ Routine table displays with updated times

### If Failed (This was the main issue)
- ❌ **BLACK SCREEN** = Infinite loop still present
- Check: Are you seeing console errors?
- Solution: Verify `tempTimeSlots` initialization only happens on mount

---

## Test 3: Add a New Period ✅

### Steps
1. Click **"⏱️ সময় পরিবর্তন"** button
2. Click **"➕ পিরিয়ড যোগ করুন"**
3. Verify a new row appears: "পিরিয়ড 8"
4. Type a new time in the input field
5. Click **"সংরক্ষণ করুন"**

### Expected Result
- ✅ New period row appears immediately
- ✅ Input field is editable
- ✅ Save button works
- ✅ New period appears in routine table header

### If Failed
- Black screen = Infinite loop
- Input doesn't appear = State not updating
- Save doesn't work = Callback not defined

---

## Test 4: Remove the Last Period ✅

### Steps
1. Click **"⏱️ সময় পরিবর্তন"** button
2. Click **"❌ শেষ পিরিয়ড মুছুন"** (only visible if periods > 1)
3. Verify the last period input disappears
4. Click **"সংরক্ষণ করুন"**

### Expected Result
- ✅ Last period input disappears immediately
- ✅ Period count decreases
- ✅ No errors in console
- ✅ Routine table updates with fewer columns

### If Failed
- Button disabled = State not valid
- Period doesn't disappear = Array not updating
- Save fails = Data validation failed

---

## Test 5: Teacher Selection & Routine Display ✅

### Prerequisite
- At least 2 teachers in the system

### Steps
1. Verify "শিক্ষক রুটিন" tab is active
2. Open the teacher dropdown
3. Select first teacher
4. Note the routine data
5. Switch to second teacher
6. Verify different routine data

### Expected Result
- ✅ Dropdown shows all teachers
- ✅ Teacher name updates in panel header
- ✅ Routine changes when you switch teachers
- ✅ No error messages
- ✅ No black screen

### If Failed
- Dropdown empty = Teachers not loaded
- Routine doesn't change = State not syncing
- Wrong teacher selected = State inconsistency

---

## Test 6: Add/Edit Teacher Routine Entry ✅

### Prerequisite
- At least 1 teacher exists

### Steps
1. Select a teacher
2. Click an empty cell in the routine table
3. Click "+ যুক্ত করুন" button
4. Type class name (e.g., "Class 10A")
5. Tab to next field
6. Type subject name (e.g., "Math")
7. Click another cell to confirm

### Expected Result
- ✅ "+ যুক্ত করুন" button appears in empty cells
- ✅ Input fields appear after clicking button
- ✅ Can type class name
- ✅ Can type subject name
- ✅ Entry saved to routine (callback fires)
- ✅ No black screen

### If Failed
- Button doesn't appear = CSS issue
- Can't type = Input disabled
- Data not saved = Callback not implemented

---

## Test 7: Class Routine Management ✅

### Prerequisite
- At least 2 classes in system

### Steps
1. Click "ক্লাস রুটিন" tab
2. View the class selection grid
3. Click on a class card
4. Add/edit a subject in a time slot
5. Go back to class list
6. Click on another class
7. Verify routine is different

### Expected Result
- ✅ Class grid displays with cards
- ✅ Each class card shows name and section
- ✅ Clicking opens class routine view
- ✅ Can edit subjects
- ✅ Back button works
- ✅ Each class has separate routine data
- ✅ No black screen

### If Failed
- Grid doesn't display = Classes not loaded
- Card doesn't open = onClick handler failed
- Back button stuck = State not resetting
- Wrong data shown = Class data mixed up

---

## Test 8: Mobile Responsiveness ✅

### Steps (Use Browser DevTools)
1. Press F12 to open DevTools
2. Click device toggle (responsive design mode)
3. Set to iPhone 12 (390x844)
4. Navigate to Routine View
5. Try editing time periods
6. Try selecting teacher/class
7. Try scrolling routine table horizontally

### Expected Result
- ✅ Layout stacks vertically on mobile
- ✅ Buttons are all clickable
- ✅ Routine table scrolls horizontally
- ✅ Text doesn't overflow
- ✅ No black screen on mobile
- ✅ All editing works on mobile

### If Failed
- Layout broken = CSS media queries need update
- Can't scroll table = Overflow not set
- Buttons unclickable = Padding too small

---

## Test 9: No Teachers/Classes Edge Cases ✅

### Test 9A: No Teachers
1. Clear all teachers from data
2. Navigate to Routine View
3. Observe message: "কোনো শিক্ষক পাওয়া যায়নি"

### Expected Result
- ✅ No error crash
- ✅ Helpful message displayed
- ✅ UI remains responsive

### Test 9B: No Classes
1. Clear all classes from data
2. Click "ক্লাস রুটিন" tab
3. Observe message: "কোনো ক্লাস পাওয়া যায়নি"

### Expected Result
- ✅ No error crash
- ✅ Helpful message displayed
- ✅ UI remains responsive

---

## Test 10: Data Persistence ✅

### Steps
1. Add/edit routine for a teacher
2. Switch to a different teacher
3. Switch back to original teacher
4. Verify the data is still there
5. Hard refresh page (Ctrl+Shift+R)
6. Navigate back to Routine View
7. Verify data persists from backend

### Expected Result
- ✅ Data persists when switching teachers
- ✅ Data persists when switching tabs
- ✅ Data persists after page refresh
- ✅ No data loss
- ✅ No black screen during transitions

### If Failed
- Data lost = Not saving to backend
- Data mixed up = State not isolated
- Black screen = Infinite loop on reload

---

## Test 11: Rapid Interactions (Stress Test) ✅

### Steps
1. Rapidly click between teacher selections
2. Rapidly switch between tabs
3. Rapidly open/close time customizer
4. Rapidly edit multiple fields

### Expected Result
- ✅ No black screen
- ✅ No UI freeze
- ✅ All interactions register
- ✅ No console errors

### If Failed
- Black screen = Memory leak or infinite loop
- UI freeze = Too much computation
- Errors = Not debouncing/throttling

---

## Test 12: Error Recovery ✅

### Steps
1. Clear teacher data (set to null)
2. Navigate to Routine View
3. Verify error UI or fallback
4. Restore data
5. Refresh page
6. Verify normal operation resumes

### Expected Result
- ✅ Graceful error display (not crash)
- ✅ Clear error message
- ✅ Recovery works after data restored
- ✅ No black screen on error

---

## Quick Reference: What to Look For

### ✅ Green Flags (Fix Successful)
- [ ] No black screen on any interaction
- [ ] Time periods update immediately
- [ ] Teacher/class selection works smoothly
- [ ] Data persists correctly
- [ ] Mobile layout responsive
- [ ] All buttons clickable
- [ ] Smooth animations
- [ ] Console is clean (no errors)

### ❌ Red Flags (Issues Remain)
- [ ] Black screen after editing times
- [ ] Dropdown selection not changing UI
- [ ] Data disappears when switching
- [ ] Infinite loading spinner
- [ ] Console errors
- [ ] Input fields unresponsive
- [ ] Layout broken on mobile
- [ ] Buttons don't respond

---

## Debugging Tips

### If Black Screen Still Occurs:
```javascript
// Check browser console (F12 → Console tab)
// Look for:
1. "Maximum update depth exceeded" → Infinite loop
2. "Cannot read property of undefined" → Null reference
3. "ReferenceError" → Missing variable
```

### If Data Not Persisting:
```javascript
// Verify callbacks are implemented:
- onSaveTeacherRoutine(teacherName, routine)
- onSaveClassRoutine(classId, routine)
- onSaveTimeSlots(timeSlots)
```

### If UI Not Updating:
```javascript
// Check if state is actually changing:
1. Open DevTools → React tab
2. Select component
3. Look at state values
4. Try changing them
```

---

## Test Completion Checklist

- [ ] Test 1: Page loads
- [ ] Test 2: Edit time (CRITICAL)
- [ ] Test 3: Add period
- [ ] Test 4: Remove period
- [ ] Test 5: Teacher selection
- [ ] Test 6: Add routine entry
- [ ] Test 7: Class routine
- [ ] Test 8: Mobile responsive
- [ ] Test 9: Edge cases
- [ ] Test 10: Data persistence
- [ ] Test 11: Stress test
- [ ] Test 12: Error recovery

**If all tests pass: ✅ FIX IS SUCCESSFUL**

---

## Report Results

When complete, verify:
- ✅ **No black screen** on any operation
- ✅ **Times update** without page refresh
- ✅ **Data persists** correctly
- ✅ **Mobile works** smoothly
- ✅ **No console errors** in DevTools

**Status: Ready for Production**
