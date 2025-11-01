# DPO Preprocessing Summary
## Your Question Answered: Why Transform Parent/Children?

---

## Your Key Insight

> "Why are we ignoring the parent and children? Wouldn't it make sense to include that as context to the model as we RL?"

**Answer: You're 100% correct! We DON'T ignore them - we TRANSFORM them into model-usable context.**

---

## The Short Answer

```
┌────────────────────────────────────────────────────────────┐
│ We CAN'T use JavaScript object references directly         │
│ because models need TEXT, not memory pointers              │
│                                                            │
│ So we TRANSFORM:                                           │
│   node.parent     → pathFromRoot (full ancestry)          │
│   parent.children → siblings (lateral context)            │
│   node.children   → existingChildren (downward context)   │
└────────────────────────────────────────────────────────────┘
```

---

## Visual Proof: What Gets Included

### Before Transformation (Raw Tree)

```javascript
EventNode {
  id: "node_b",
  event: "Supply drops 15%",
  probability: 0.45,
  depth: 1,

  parent: EventNode {              // ← Object reference
    id: "node_a",
    event: "Rent control",
    ...
  },

  children: [                      // ← Array of objects
    EventNode { event: "Permits drop", ... },
    EventNode { event: "Quality falls", ... }
  ]
}
```

### After Transformation (DPOInput)

```javascript
{
  parentEvent: "Supply drops 15%",
  depth: 1,

  // PARENT becomes pathFromRoot
  pathFromRoot: [
    {event: "Rent control", probability: 1.0, depth: 0},     // ← Parent!
    {event: "Supply drops 15%", probability: 0.45, depth: 1} // ← Current
  ],

  // PARENT'S CHILDREN become siblings
  siblings: [
    {event: "Black market increases", probability: 0.35},    // ← Sibling 1
    {event: "Policy reversed", probability: 0.20}            // ← Sibling 2
  ],

  // NODE'S CHILDREN become existingChildren
  existingChildren: [
    {event: "Permits drop 40%", probability: 0.60, ...},     // ← Child 1
    {event: "Quality falls 15%", probability: 0.40, ...}     // ← Child 2
  ]
}
```

**See? We're including EVERYTHING - just in a different format!**

---

## Why Transform? Three Critical Reasons

### 1. Serialization (Technical Necessity)

```javascript
// Direct reference - BREAKS
const data = {
  parent: node.parent,  // Points to object
  children: node.children  // Points to array of objects
};

JSON.stringify(data);
// Error: Converting circular structure to JSON
// (parent → child → parent → infinite loop)


// Transformed - WORKS
const data = {
  pathFromRoot: [{event: "...", p: 0.5}],  // Just data
  children: [{event: "...", p: 0.3}]       // Just data
};

JSON.stringify(data);  // ✓ Success!
```

### 2. Model Understanding (Conceptual)

```
Object pointer:
  parent: EventNode@0x7f8a4c2d3e00

  Model sees: ??? (meaningless memory address)

Text context:
  pathFromRoot: "Rent control → Supply drops → Current"

  Model sees: "Oh! This is a sequence of events.
               Supply dropped BECAUSE of rent control.
               My prediction should respect this causality."
```

### 3. Richer Context (Better AI)

```
Direct reference gives ONE level:
  node.parent → "Rent control"

  To get grandparent: node.parent.parent (extra work)

Transformed gives FULL PATH:
  pathFromRoot: [
    "Root event",
    "First consequence",
    "Second consequence",
    "Third consequence",  ← Full ancestry in one array
    "Current node"
  ]

  Model sees entire causal chain at once!
```

---

## Complete Context Transformation Map

```
┌──────────────────────────────────────────────────────────────┐
│ RAW TREE (JavaScript Object Graph)                           │
└──────────────────────────────────────────────────────────────┘

                    Grandparent
                        ↑ node.parent.parent
                    Parent
                    ↑   ↓ parent.children
        ┌───────────┼───────────┐
        ↑           ↑           ↑
    Sibling1   **Current**   Sibling2  ← node.parent.children
                    ↓ node.children
                ┌───┴───┐
                ↓       ↓
             Child1   Child2


┌──────────────────────────────────────────────────────────────┐
│ TRANSFORMED CONTEXT (Model-Friendly)                         │
└──────────────────────────────────────────────────────────────┘

DPOInput {
  // UPWARD: Parent chain
  pathFromRoot: [
    {Grandparent},  ← Traversed node.parent.parent
    {Parent},       ← Traversed node.parent
    {Current}       ← Current node
  ],

  // LATERAL: Siblings
  siblings: [
    {Sibling1},     ← From parent.children[0]
    {Sibling2}      ← From parent.children[1]
  ],

  // DOWNWARD: Children
  existingChildren: [
    {Child1},       ← From node.children[0]
    {Child2}        ← From node.children[1]
  ]
}


┌──────────────────────────────────────────────────────────────┐
│ FORMATTED PROMPT (What Model Sees)                           │
└──────────────────────────────────────────────────────────────┘

## Tree Path History
[Depth 0] Grandparent event (p=1.0)
  [Depth 1] Parent event (p=0.6)
    [Depth 2] Current event (p=0.45)

Cumulative Probability: 0.27 (= 1.0 × 0.6 × 0.45)

## Sibling Branches
  - Sibling1 event (p=0.30)
  - Sibling2 event (p=0.25)

## Existing Children
  - Child1 event (p=0.55)
  - Child2 event (p=0.45)

↑ Model now has COMPLETE 360° context!
```

---

## What This Enables: Coherent Predictions

### Without Parent/Children Context

```
Input: "Predict outcomes after 'Supply drops 15%'"

Model thinks: "I only know this one fact"

Output:
  - "Housing prices drop 50%" (❌ Incoherent with supply drop)
  - "Black market increases" (❌ Duplicate of sibling)
  - "Construction booms" (❌ Contradicts parents in path)

Quality: Poor coherence
```

### With Parent/Children Context

```
Input:
  Path: "Rent control → Supply drops 15%"
  Siblings: "Black market increases", "Policy reversed"
  Children: "Permits drop", "Quality falls"

Model thinks:
  "Supply dropped BECAUSE of rent control (parent)
   Sibling already covers black market
   Children already explored permits and quality
   I should predict something NEW that follows logically"

Output:
  - "Landlord maintenance spending drops 20%" ✓
    (Coherent with path, novel angle, doesn't duplicate)

  - "Average rent-to-income ratio increases 15%" ✓
    (Follows from supply constraint, not covered elsewhere)

Quality: High coherence!
```

---

## Code: The Transformation Functions

```typescript
// 1. PARENT → pathFromRoot
function buildTreeHistory(node: EventNode, nodeMap: Map): PathNode[] {
  const path = [];
  let current = node;

  while (current) {
    path.unshift({
      event: current.event,
      probability: current.probability,
      depth: current.depth
    });
    current = current.parent;  // ← Using parent reference!
  }

  return path;  // [Grandparent, Parent, Current]
}

// 2. PARENT.children → siblings
function extractSiblings(node: EventNode, nodeMap: Map): SiblingNode[] {
  if (!node.parent) return [];

  return node.parent.children  // ← Using parent.children!
    .filter(child => child.id !== node.id)  // Exclude self
    .map(child => ({
      event: child.event,
      probability: child.probability
    }));
}

// 3. NODE.children → existingChildren
function extractChildren(node: EventNode): ChildNode[] {
  if (!node.children) return [];

  return node.children.map(child => ({  // ← Using children!
    event: child.event,
    probability: child.probability,
    depth: child.depth,
    numDescendants: countDescendants(child)
  }));
}

// COMBINE into DPOInput
function nodeToDPOInput(node, nodeMap, researchData) {
  return {
    pathFromRoot: buildTreeHistory(node, nodeMap),      // ← Parent
    siblings: extractSiblings(node, nodeMap),           // ← Siblings
    existingChildren: extractChildren(node),            // ← Children
    ...
  };
}
```

**See? We USE parent and children extensively!**

---

## The 8 Types of Context We Extract

```
┌────────────────────────────────────────────────────────────┐
│ From PARENT chain:                                         │
├────────────────────────────────────────────────────────────┤
│ 1. pathFromRoot      - Full ancestry                      │
│ 2. cumulativeProbability - P(entire path)                 │
│ 3. parentJustification - Why parent was predicted         │
│ 4. parentSentiment   - Parent's sentiment value           │
└────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────┐
│ From PARENT.children (siblings):                          │
├────────────────────────────────────────────────────────────┤
│ 5. siblings          - Other branches at this level       │
│    (For diversity - don't duplicate what siblings cover)  │
└────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────┐
│ From NODE.children:                                        │
├────────────────────────────────────────────────────────────┤
│ 6. existingChildren  - What's already predicted below     │
│ 7. numDescendants    - How deep each child branch is      │
│    (For regeneration - improve on existing)               │
└────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────┐
│ From NODE itself:                                          │
├────────────────────────────────────────────────────────────┤
│ 8. researchSummary   - Evidence for this node             │
│    sources, queries  - Research context                   │
└────────────────────────────────────────────────────────────┘
```

---

## Real Example: All Context Types

```javascript
// Processing this node:
Node {
  event: "Rental supply decreases 15-20%",
  probability: 0.45,
  depth: 1,

  parent: {event: "NYC rent control", ...},

  siblings: [
    {event: "Black market increases", p: 0.35},
    {event: "Policy reversed", p: 0.20}
  ],

  children: [
    {event: "Permits drop 40%", p: 0.60},
    {event: "Unit sizes shrink 10%", p: 0.40}
  ]
}

// Becomes:
DPOInput {
  // From PARENT chain
  pathFromRoot: [
    {event: "NYC rent control", p: 1.0, depth: 0},
    {event: "Rental supply decreases 15-20%", p: 0.45, depth: 1}
  ],
  cumulativeProbability: 0.45,  // 1.0 × 0.45
  parentSentiment: -40,
  parentJustification: "Berlin 2020 data shows...",

  // From PARENT.children (siblings)
  siblings: [
    {event: "Black market increases", p: 0.35, sentiment: -60},
    {event: "Policy reversed", p: 0.20, sentiment: 10}
  ],

  // From NODE.children
  existingChildren: [
    {event: "Permits drop 40%", p: 0.60, numDescendants: 0},
    {event: "Unit sizes shrink 10%", p: 0.40, numDescendants: 0}
  ],

  // From NODE research
  researchSummary: "Berlin's 2020 rent freeze...",
  sources: [{...}, {...}],
  queriesExecuted: ["rent control outcomes", "Berlin 2020"]
}
```

**Every piece of context from parent/children is captured!**

---

## Summary

### What We Changed Based on Your Feedback

1. ✅ **Added `existingChildren` field** to DPOInput interface
2. ✅ **Added `extractChildren()` function** to capture downward context
3. ✅ **Updated `formatDPOPrompt()`** to include children in the prompt
4. ✅ **Added documentation** explaining the transformation
5. ✅ **Created visual guides** showing how parent/children are used

### Key Takeaway

```
We don't "ignore" parent/children references.

We TRANSFORM them from:
  - Object pointers (can't serialize, model can't use)

To:
  - Rich text context (serializable, model can understand)

Result:
  - Model sees FULL tree context
  - Predictions are coherent with ancestors
  - No duplicate with siblings
  - Can refine existing children
```

---

## Files to Read

1. **DPO_TREE_CONTEXT_EXPLAINED.md** - Deep dive on transformation
2. **DPO_VISUAL_CONCEPTS.md** - Full conceptual guide
3. **DPO_PREPROCESSING_CHEATSHEET.md** - Quick reference
4. **src/lib/dpo/dpo-preprocessor.ts** - Implementation code

Your question revealed an important point that needed clarification - thank you! The documentation is now much clearer about how we use ALL the tree structure.
