---
name: vector-space-newsroom
description: Use this skill to turn Vector Space activity information, event notes, agendas, interview notes, photos, attendee lists, or rough bullet points into Chinese news releases, public-account articles, media briefs, government-style reports, developer/community recaps, salon posts, or charity/public-welfare stories. It identifies the event scene, stakeholder level, communication purpose, suitable tone, article angle, and output structure before drafting.
---

# Vector Space Newsroom

## Purpose

Use this skill when creating Chinese press materials for 向量维度 Vector Space from activity information. It must classify the scene first, then draft with a matching viewpoint, tone, and structure.

Always read `references/company-profile.md` when the user needs company positioning, product names, strategic language, or boilerplate company introduction.

Always read `references/founder-profile.md` when 孔馗, the founder, "我", "创始人", "董事长", "孔老师", or a founder speech/interview/attendance is part of the activity.

## Required Workflow

1. Extract facts from the user's material:
   - activity name, date, location, organizer, co-organizer, participants
   - government/enterprise/school/community roles and titles
   - agenda, speeches, signing/launch/visit/training/demo/roadshow links
   - product or business lines involved
   - outcomes, next steps, cooperation intentions, quotes, photos if supplied

2. Classify the scene before writing:
   - `government-public`: government leaders, departments, parks, public institutions, policy promotion, official visits, symposiums, signing ceremonies
   - `enterprise-industry`: enterprise clients, industry associations, business cooperation, AI transformation, product solution delivery
   - `developer-tech`: developers, hackathons, product demos, open-source, agent/workflow/AI coding communities
   - `salon-community`: creator salons, entrepreneurship meetups, AI experience events, brand/community growth activities
   - `education-campus`: universities, vocational colleges, teacher training, student training, curriculum cooperation, practice bases
   - `public-welfare`: charity, rural revitalization, youth support, inclusive AI education, social responsibility
   - `product-launch`: product release, feature upgrade, platform version, case announcement

3. Determine hierarchy and emphasis:
   - If officials or institutional leaders attend, list roles accurately and place public value, regional development, policy fit, and implementation outcomes before brand promotion.
   - If enterprise executives attend, emphasize business pain points, solution value, cooperation mechanism, efficiency improvement, and deliverables.
   - If developers or creators attend, emphasize technology, experience, community energy, demos, surprises, and takeaways.
   - If public welfare is central, emphasize people, dignity, inclusion, long-term companionship, and social value.
   - If the founder attends, choose the founder title from `references/founder-profile.md` according to scene and hierarchy; do not stack all titles in one sentence.

4. Choose the output type:
   - If the user specifies a format, follow it.
   - If not specified, produce a WeChat-style news release with headline, subtitle/deck, body, and optional company boilerplate.
   - For official/government scenes, prefer a sober release or briefing.
   - For developer/salon scenes, prefer a lively recap with concrete moments.
   - For charity scenes, prefer a warm story-driven article.

5. Draft, then self-check:
   - No invented dates, titles, organizations, numbers, signings, funding, or policy names.
   - Keep official titles conservative. If unsure, write "相关负责人", "代表", or ask for confirmation.
   - For founder titles, use one primary title plus at most one relevant secondary title unless the user asks for a full bio.
   - Keep the brand visible but not overbearing in public/government writing.
   - Use "向量维度 Vector Space" on first mention, then "向量维度" where natural.
   - Use product names exactly: `vector image`, `Open Vector`, `Meta Stream`, `Vector Code`.

## Founder Handling

When founder information is relevant, load `references/founder-profile.md` and select the title by scene:

- `government-public`: "安徽向量维度智能科技有限公司创始人兼董事长" or "向量维度 Vector Space 创始人兼董事长". Add "中国计算机函授学院人工智能学院院长" only when education, talent training, or institutional cooperation is central.
- `enterprise-industry`: "向量维度 Vector Space 创始人兼董事长、政企 AI 数字化转型实战派".
- `developer-tech`: "向量维度 Vector Space 创始人、AIGC 前沿技术落地推动者" or "AI-native 生产力实践者".
- `salon-community`: "向量维度 Vector Space 创始人、OPC 超级个体生产力模式倡导者".
- `education-campus`: "中国计算机函授学院人工智能学院院长、安徽医科大学生物医学工程学院硕士生导师、向量维度 Vector Space 创始人".
- `public-welfare`: "向量维度 Vector Space 创始人、AI 赋能乡村振兴实践者".

Founder writing rules:

- Use "孔馗" or "孔馗老师" based on context. Use "孔馗老师" for campus, training, salon, and public-account warmth; use "孔馗" in formal releases.
- Avoid turning the lead into a full resume. Put only the title needed for credibility.
- Founder quotes should sound grounded: emphasize application, practice, talent, productivity, inclusion, or regional industry value.
- Do not claim national firsts, official recognition, book status, or service scale unless those facts appear in the provided material or founder profile and fit the article.
- If a sensitive or high-authority claim is central, mark it as a confirmation point instead of overstating it.

## Tone Matrix

### government-public

Tone: formal, steady, public-sector friendly, policy-aware.

Structure:
1. Lead with activity fact and institutional significance.
2. Mention participating units and leader titles in order of public hierarchy when provided.
3. Summarize discussion/visit/signing/training content.
4. Connect Vector Space capabilities to regional AI application, SME transformation, entrepreneurship incubation, talent training, or demonstration projects.
5. End with cooperation outlook and implementation language.

Good phrases:
- "围绕人工智能应用落地、产业赋能和人才培养展开交流"
- "为区域数字经济发展和中小企业智能化转型提供新抓手"
- "推动人工智能技术从能力展示走向场景应用"

Avoid:
- over-hyped adjectives, internet slang, aggressive sales language
- saying government endorsed the company unless explicitly stated
- ranking leaders when titles are incomplete

### enterprise-industry

Tone: professional, practical, value-oriented.

Structure:
1. Identify industry context and business pain point.
2. Explain what was shared, demonstrated, delivered, or agreed.
3. Map Vector Space product matrix to enterprise use cases.
4. Emphasize measurable or operational value if provided.
5. End with next-step cooperation.

### developer-tech

Tone: sharp, energetic, tech-forward, community-aware.

Structure:
1. Open with the most exciting demo, build moment, or technical theme.
2. Explain key technologies and product capabilities in accessible language.
3. Highlight developer participation, questions, experiments, and takeaways.
4. Use concrete verbs: "搭建", "调试", "生成", "编排", "部署", "共创".
5. End with community invitation or next event when appropriate.

### salon-community

Tone: vivid, fresh, friendly, "种草" but credible.

Structure:
1. Open with atmosphere and participant identity.
2. Show what people experienced, learned, or created.
3. Introduce Vector Space as an enabler of AI-native productivity or OPC entrepreneurship.
4. Add quotable short lines and memorable takeaways.
5. End with community continuation.

### education-campus

Tone: clear, constructive, education-and-practice oriented.

Structure:
1. Lead with school-enterprise collaboration, training, lecture, course, or practice activity.
2. Emphasize practical AI ability, real project experience, teacher/student growth, employment/entrepreneurship pathways.
3. Connect to AI application engineer, AI visual design, agents, workflows, AI coding, or OPC entrepreneurship.
4. End with curriculum/resource/platform cooperation.

### public-welfare

Tone: warm, restrained, human, with social responsibility.

Structure:
1. Start from people and the concrete need, not from the company.
2. Show the action, companionship, resource support, or inclusive learning opportunity.
3. Explain how AI technology becomes accessible and useful.
4. Connect to Vector Space's long-term responsibility only after the story is grounded.
5. End with continued commitment.

Avoid pitying language, exaggerated emotion, and using beneficiaries as props.

### product-launch

Tone: confident, concise, product-led.

Structure:
1. Announce product/version/capability.
2. Explain target users and scenarios.
3. Give 3-5 concrete capabilities.
4. Connect to the AI-native product matrix.
5. End with availability, trial, or roadmap if supplied.

## Angle Selection

Choose one dominant angle and keep the article coherent:

- `policy-value`: regional AI application, digital economy, SME transformation
- `industry-solution`: solving enterprise workflows and productivity bottlenecks
- `tech-build`: agents, workflows, AI coding, product demo, developer experience
- `opportunity-opc`: one-person company, entrepreneurship, low-cost MVP, AI team
- `talent-education`: AI practice ability, curriculum, employment, teacher training
- `human-impact`: inclusion, public welfare, social value
- `brand-product`: product matrix, platform upgrade, commercial launch

If the material fits multiple angles, use the primary scene to decide the lead and use secondary angles later in the article.

## Output Requirements

Unless the user asks otherwise, return:

- 3 headline options with different strengths
- final selected headline
- article body
- optional short social-media caption
- list of missing facts or confirmation points, only if important

For government-public drafts, include a polished but conservative title and avoid clickbait headline options.

For lively community drafts, headline options may be more expressive, but do not use empty hype.

## Company Reference

Load `references/company-profile.md` for:

- official company positioning
- product matrix and exact product names
- strategic scenarios: OPC,政企 AI 产业赋能, AI 职业教育与人才培养
- reusable boilerplate paragraphs

Load `references/founder-profile.md` for:

- founder titles by scenario
- founder public biography
- founder viewpoints and quote angles
- title guardrails and conservative wording
