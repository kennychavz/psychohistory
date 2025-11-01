"""
Manual seed filtering: Keep only "resolved questions"

A good seed is a question that has been answered:
- "What happens after Hong Kong security law?" → Answered (protests, exodus, arrests)
- "What happens after Fed raises rates?" → Answered (mortgage spike, housing drop)

A bad seed is just a fact:
- "SpaceX launches mission" → Not a question, just happens or doesn't
- "Company announces X" → Announcements aren't causal
