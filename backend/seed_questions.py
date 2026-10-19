
from app.core.database import database

questions_collection = database["questions"]

questions = [
    {
        "platform": "leetcode",
        "platform_id": "two-sum",
        "title": "Two Sum",
        "url": "https://leetcode.com/problems/two-sum/",
        "difficulty": "easy",
        "topics": ["Arrays", "Hash Table"],
        "company_tags": [],
        "frequency_score": 10,
    },
    {
        "platform": "leetcode",
        "platform_id": "longest-substring-without-repeating-characters",
        "title": "Longest Substring Without Repeating Characters",
        "url": "https://leetcode.com/problems/longest-substring-without-repeating-characters/",
        "difficulty": "medium",
        "topics": ["Strings", "Sliding Window"],
        "company_tags": [],
        "frequency_score": 9,
    },
    {
        "platform": "leetcode",
        "platform_id": "trapping-rain-water",
        "title": "Trapping Rain Water",
        "url": "https://leetcode.com/problems/trapping-rain-water/",
        "difficulty": "hard",
        "topics": ["Arrays", "Two Pointers"],
        "company_tags": [],
        "frequency_score": 8,
    },
    {
        "platform": "leetcode",
        "platform_id": "contains-duplicate",
        "title": "Contains Duplicate",
        "url": "https://leetcode.com/problems/contains-duplicate/",
        "difficulty": "easy",
        "topics": ["Arrays", "Hash Table"],
        "company_tags": [],
        "frequency_score": 8,
    },
    {
        "platform": "leetcode",
        "platform_id": "valid-parentheses",
        "title": "Valid Parentheses",
        "url": "https://leetcode.com/problems/valid-parentheses/",
        "difficulty": "easy",
        "topics": ["Strings", "Stack"],
        "company_tags": [],
        "frequency_score": 9,
    },
    {
        "platform": "leetcode",
        "platform_id": "group-anagrams",
        "title": "Group Anagrams",
        "url": "https://leetcode.com/problems/group-anagrams/",
        "difficulty": "medium",
        "topics": ["Strings", "Hash Table"],
        "company_tags": [],
        "frequency_score": 9,
    },
    {
        "platform": "leetcode",
        "platform_id": "3sum",
        "title": "3Sum",
        "url": "https://leetcode.com/problems/3sum/",
        "difficulty": "medium",
        "topics": ["Arrays", "Two Pointers"],
        "company_tags": [],
        "frequency_score": 9,
    },
    {
        "platform": "leetcode",
        "platform_id": "number-of-islands",
        "title": "Number of Islands",
        "url": "https://leetcode.com/problems/number-of-islands/",
        "difficulty": "medium",
        "topics": ["Graphs", "DFS"],
        "company_tags": [],
        "frequency_score": 9,
    },
    {
        "platform": "leetcode",
        "platform_id": "merge-k-sorted-lists",
        "title": "Merge k Sorted Lists",
        "url": "https://leetcode.com/problems/merge-k-sorted-lists/",
        "difficulty": "hard",
        "topics": ["Linked List", "Heap"],
        "company_tags": [],
        "frequency_score": 8,
    },
    {
        "platform": "leetcode",
        "platform_id": "minimum-window-substring",
        "title": "Minimum Window Substring",
        "url": "https://leetcode.com/problems/minimum-window-substring/",
        "difficulty": "hard",
        "topics": ["Strings", "Sliding Window"],
        "company_tags": [],
        "frequency_score": 9,
    },
]

inserted = 0
updated = 0

for question in questions:
    result = questions_collection.update_one(
        {
            "platform": question["platform"],
            "platform_id": question["platform_id"],
        },
        {"$set": question},
        upsert=True,
    )

    if result.upserted_id is not None:
        inserted += 1
    elif result.modified_count:
        updated += 1

print(f"Seed complete. Inserted: {inserted}, updated: {updated}")
print("Total questions in MongoDB:", questions_collection.count_documents({}))
