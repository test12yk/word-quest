// 레벨 → 스테이지 → 단어 데이터.
// 단어 형식: [영단어, 품사(n/v/adj/adv), 뜻, 예문(대상 단어를 *...*로 감쌈), 예문 해석]
// 예문 속 *...*는 영단어와 똑같은 형태여야 합니다(빈칸 퀴즈가 이 표시를 이용). `node tests/test.mjs`로 검증됩니다.

const RAW = [
  {
    id: 1, name: '새싹', icon: '🌱', desc: '초등~중1 기초',
    stages: [
      { name: '일상 동사', words: [
        ['wake up', 'v', '일어나다', 'I *wake up* at seven every day.', '나는 매일 7시에 일어난다.'],
        ['borrow', 'v', '빌리다', 'Can I *borrow* your pen?', '펜 좀 빌려도 될까?'],
        ['carry', 'v', '나르다, 들고 다니다', 'Please *carry* this bag for me.', '이 가방 좀 들어 주세요.'],
        ['cook', 'v', '요리하다', 'My dad likes to *cook* on weekends.', '아빠는 주말에 요리하는 것을 좋아하신다.'],
        ['wash', 'v', '씻다', 'You should *wash* your hands before eating.', '먹기 전에 손을 씻어야 한다.'],
        ['leave', 'v', '떠나다', 'We *leave* for school at eight.', '우리는 8시에 학교로 출발한다.'],
        ['count', 'v', '세다', "Let's *count* from one to ten.", '1부터 10까지 세어 보자.'],
        ['wait', 'v', '기다리다', 'Please *wait* here for a moment.', '여기서 잠시만 기다려 주세요.'],
      ] },
      { name: '학교와 사물', words: [
        ['lesson', 'n', '수업, 교훈', "Today's *lesson* is about animals.", '오늘 수업은 동물에 관한 것이다.'],
        ['homework', 'n', '숙제', 'I finished my *homework* early.', '나는 숙제를 일찍 끝냈다.'],
        ['library', 'n', '도서관', 'She reads books in the *library*.', '그녀는 도서관에서 책을 읽는다.'],
        ['notebook', 'n', '공책', 'Write it in your *notebook*.', '그것을 공책에 적어라.'],
        ['subject', 'n', '과목, 주제', 'Math is my favorite *subject*.', '수학은 내가 가장 좋아하는 과목이다.'],
        ['desk', 'n', '책상', 'The books are on the *desk*.', '책들이 책상 위에 있다.'],
        ['exam', 'n', '시험', 'I have an *exam* tomorrow.', '나는 내일 시험이 있다.'],
        ['classmate', 'n', '반 친구', 'My *classmate* helped me with the project.', '반 친구가 프로젝트를 도와주었다.'],
      ] },
      { name: '음식과 장소', words: [
        ['delicious', 'adj', '맛있는', 'This soup is *delicious*.', '이 수프는 맛있다.'],
        ['hungry', 'adj', '배고픈', 'I am so *hungry* right now.', '나는 지금 너무 배가 고프다.'],
        ['bakery', 'n', '빵집', 'The *bakery* opens at six.', '그 빵집은 6시에 문을 연다.'],
        ['market', 'n', '시장', 'We buy fresh fruit at the *market*.', '우리는 시장에서 신선한 과일을 산다.'],
        ['restaurant', 'n', '식당', 'They ate dinner at a new *restaurant*.', '그들은 새 식당에서 저녁을 먹었다.'],
        ['drink', 'v', '마시다', 'You should *drink* more water.', '너는 물을 더 마셔야 한다.'],
        ['hospital', 'n', '병원', 'My aunt works at the *hospital*.', '이모는 병원에서 일하신다.'],
        ['station', 'n', '역', 'Meet me at the train *station*.', '기차역에서 만나자.'],
      ] },
      { name: '감정과 상태', words: [
        ['angry', 'adj', '화난', 'He was *angry* about the mistake.', '그는 그 실수에 화가 났다.'],
        ['proud', 'adj', '자랑스러운', 'I am *proud* of you.', '나는 네가 자랑스럽다.'],
        ['nervous', 'adj', '긴장한', 'She felt *nervous* before the speech.', '그녀는 연설 전에 긴장했다.'],
        ['lonely', 'adj', '외로운', 'He felt *lonely* in the new city.', '그는 새 도시에서 외로움을 느꼈다.'],
        ['surprised', 'adj', '놀란', 'We were *surprised* by the news.', '우리는 그 소식에 놀랐다.'],
        ['tired', 'adj', '피곤한', 'I was too *tired* to study.', '나는 너무 피곤해서 공부할 수 없었다.'],
        ['excited', 'adj', '신이 난', 'The kids are *excited* about the trip.', '아이들은 여행에 신이 나 있다.'],
        ['worry', 'v', '걱정하다', "Don't *worry* about the test.", '시험은 걱정하지 마.'],
      ] },
    ],
  },
  {
    id: 2, name: '새잎', icon: '🌿', desc: '중등 필수',
    stages: [
      { name: '생활 동사', words: [
        ['invite', 'v', '초대하다', 'I want to *invite* you to my party.', '너를 내 파티에 초대하고 싶어.'],
        ['improve', 'v', '향상시키다, 개선하다', 'Reading helps you *improve* your English.', '독서는 영어 실력을 향상시키는 데 도움이 된다.'],
        ['share', 'v', '나누다, 공유하다', 'Please *share* your ideas with the group.', '여러분의 생각을 모둠과 공유해 주세요.'],
        ['decide', 'v', '결정하다', 'It is hard to *decide* what to eat.', '무엇을 먹을지 결정하기가 어렵다.'],
        ['prepare', 'v', '준비하다', 'We need to *prepare* for the trip.', '우리는 여행을 준비해야 한다.'],
        ['repeat', 'v', '반복하다', 'Could you *repeat* that, please?', '다시 한번 말씀해 주시겠어요?'],
        ['mention', 'v', '언급하다', 'She did not *mention* the problem.', '그녀는 그 문제를 언급하지 않았다.'],
        ['protect', 'v', '보호하다', 'We must *protect* the environment.', '우리는 환경을 보호해야 한다.'],
      ] },
      { name: '사람과 관계', words: [
        ['neighbor', 'n', '이웃', 'Our *neighbor* is very kind.', '우리 이웃은 아주 친절하다.'],
        ['relative', 'n', '친척', 'I visit my *relative* in Busan every summer.', '나는 매년 여름 부산에 사는 친척을 방문한다.'],
        ['stranger', 'n', '낯선 사람', "Don't talk to a *stranger* online.", '온라인에서 낯선 사람과 이야기하지 마라.'],
        ['customer', 'n', '손님, 고객', 'The *customer* asked for a refund.', '그 고객은 환불을 요청했다.'],
        ['teenager', 'n', '십대', 'My brother is a *teenager* now.', '내 형은 이제 십대이다.'],
        ['citizen', 'n', '시민', 'Every *citizen* has the right to vote.', '모든 시민은 투표할 권리가 있다.'],
        ['volunteer', 'n', '자원봉사자', 'She works as a *volunteer* at the shelter.', '그녀는 보호소에서 자원봉사자로 일한다.'],
        ['partner', 'n', '짝, 파트너', 'Find a *partner* and practice speaking.', '짝을 찾아서 말하기를 연습해라.'],
      ] },
      { name: '자연과 날씨', words: [
        ['weather', 'n', '날씨', 'The *weather* is nice today.', '오늘은 날씨가 좋다.'],
        ['temperature', 'n', '온도, 기온', 'The *temperature* dropped at night.', '밤에 기온이 떨어졌다.'],
        ['storm', 'n', '폭풍', 'A big *storm* is coming tonight.', '오늘 밤 큰 폭풍이 온다.'],
        ['forest', 'n', '숲', 'We walked through the *forest*.', '우리는 숲속을 걸었다.'],
        ['island', 'n', '섬', 'They live on a small *island*.', '그들은 작은 섬에 산다.'],
        ['valley', 'n', '계곡, 골짜기', 'A river runs through the *valley*.', '강이 계곡을 가로질러 흐른다.'],
        ['flood', 'n', '홍수', 'The *flood* damaged many houses.', '홍수로 많은 집이 피해를 입었다.'],
        ['environment', 'n', '환경', 'Plastic is bad for the *environment*.', '플라스틱은 환경에 나쁘다.'],
      ] },
      { name: '형용사 모음', words: [
        ['ordinary', 'adj', '평범한', 'It was an *ordinary* day at school.', '학교에서의 평범한 하루였다.'],
        ['dangerous', 'adj', '위험한', 'Swimming here is *dangerous*.', '여기서 수영하는 것은 위험하다.'],
        ['familiar', 'adj', '익숙한', 'Her face looks *familiar*.', '그녀의 얼굴이 낯익다.'],
        ['terrible', 'adj', '끔찍한', 'I had a *terrible* headache.', '나는 끔찍한 두통이 있었다.'],
        ['honest', 'adj', '정직한', 'He is an *honest* person.', '그는 정직한 사람이다.'],
        ['flexible', 'adj', '유연한', 'My schedule is *flexible* this week.', '이번 주 내 일정은 유연하다.'],
        ['valuable', 'adj', '소중한, 가치 있는', 'Time is *valuable*.', '시간은 소중하다.'],
        ['cheerful', 'adj', '쾌활한', 'She is always *cheerful*.', '그녀는 늘 쾌활하다.'],
      ] },
    ],
  },
  {
    id: 3, name: '나무', icon: '🌳', desc: '고등 기초',
    stages: [
      { name: '학습과 사고', words: [
        ['concentrate', 'v', '집중하다', 'It is hard to *concentrate* in a noisy room.', '시끄러운 방에서는 집중하기 어렵다.'],
        ['memorize', 'v', '암기하다', 'I *memorize* ten words every day.', '나는 매일 단어 열 개를 암기한다.'],
        ['analyze', 'v', '분석하다', 'Scientists *analyze* the data carefully.', '과학자들은 자료를 꼼꼼히 분석한다.'],
        ['imagine', 'v', '상상하다', 'Can you *imagine* life without phones?', '휴대폰 없는 삶을 상상할 수 있니?'],
        ['curious', 'adj', '호기심 많은', 'Children are *curious* about everything.', '아이들은 모든 것에 호기심이 많다.'],
        ['assume', 'v', '가정하다, 추정하다', "Don't *assume* that everyone agrees.", '모두가 동의한다고 가정하지 마라.'],
        ['evidence', 'n', '증거', 'There is no *evidence* for that claim.', '그 주장에는 증거가 없다.'],
        ['conclude', 'v', '결론짓다', 'We can *conclude* that the plan works.', '우리는 그 계획이 효과가 있다고 결론지을 수 있다.'],
      ] },
      { name: '사회와 사건', words: [
        ['government', 'n', '정부', 'The *government* announced a new policy.', '정부는 새로운 정책을 발표했다.'],
        ['society', 'n', '사회', 'Technology has changed modern *society*.', '기술은 현대 사회를 변화시켰다.'],
        ['economy', 'n', '경제', 'The *economy* is growing slowly.', '경제가 느리게 성장하고 있다.'],
        ['crisis', 'n', '위기', 'The country faced a serious *crisis*.', '그 나라는 심각한 위기에 직면했다.'],
        ['democracy', 'n', '민주주의', 'Free speech is important in a *democracy*.', '민주주의에서는 표현의 자유가 중요하다.'],
        ['tradition', 'n', '전통', 'This festival is an old *tradition*.', '이 축제는 오래된 전통이다.'],
        ['opportunity', 'n', '기회', 'This job is a great *opportunity*.', '이 일자리는 좋은 기회이다.'],
        ['community', 'n', '지역 사회', 'The *community* raised money for the school.', '지역 사회가 학교를 위해 돈을 모았다.'],
      ] },
      { name: '변화와 결과', words: [
        ['increase', 'v', '증가하다', 'Prices *increase* every year.', '물가는 해마다 오른다.'],
        ['reduce', 'v', '줄이다', 'We should *reduce* waste.', '우리는 쓰레기를 줄여야 한다.'],
        ['achieve', 'v', '이루다, 달성하다', 'She worked hard to *achieve* her goal.', '그녀는 목표를 이루기 위해 열심히 노력했다.'],
        ['affect', 'v', '영향을 미치다', 'Sleep can *affect* your mood.', '수면은 기분에 영향을 미칠 수 있다.'],
        ['consequence', 'n', '결과', 'Every choice has a *consequence*.', '모든 선택에는 결과가 따른다.'],
        ['establish', 'v', '설립하다, 확립하다', 'They plan to *establish* a new school.', '그들은 새 학교를 설립할 계획이다.'],
        ['gradually', 'adv', '서서히', 'The weather *gradually* got warmer.', '날씨가 서서히 따뜻해졌다.'],
        ['threaten', 'v', '위협하다', 'Pollution can *threaten* wildlife.', '오염은 야생동물을 위협할 수 있다.'],
      ] },
      { name: '성격과 태도', words: [
        ['generous', 'adj', '너그러운, 후한', 'He is *generous* with his time.', '그는 자기 시간을 아낌없이 내준다.'],
        ['stubborn', 'adj', '고집 센', 'My little brother is very *stubborn*.', '내 동생은 매우 고집이 세다.'],
        ['reliable', 'adj', '믿을 수 있는', 'She is a *reliable* friend.', '그녀는 믿을 수 있는 친구이다.'],
        ['selfish', 'adj', '이기적인', 'It was *selfish* to take all the cake.', '케이크를 다 가져간 것은 이기적이었다.'],
        ['confident', 'adj', '자신감 있는', 'Be *confident* and speak clearly.', '자신감을 갖고 또렷하게 말해라.'],
        ['humble', 'adj', '겸손한', 'Despite his fame, he stays *humble*.', '유명하지만 그는 겸손함을 유지한다.'],
        ['cautious', 'adj', '조심스러운', 'Be *cautious* when you cross the road.', '길을 건널 때는 조심해라.'],
        ['ambitious', 'adj', '야심 찬', 'She is an *ambitious* young leader.', '그녀는 야심 찬 젊은 지도자이다.'],
      ] },
    ],
  },
  {
    id: 4, name: '숲', icon: '🌲', desc: '수능·토익 필수',
    stages: [
      { name: '비즈니스', words: [
        ['schedule', 'n', '일정', 'Check the meeting *schedule*.', '회의 일정을 확인하세요.'],
        ['invoice', 'n', '청구서', 'Please send the *invoice* by Friday.', '금요일까지 청구서를 보내 주세요.'],
        ['negotiate', 'v', '협상하다', 'We will *negotiate* the price tomorrow.', '우리는 내일 가격을 협상할 것이다.'],
        ['deadline', 'n', '마감 기한', 'The *deadline* is next Monday.', '마감 기한은 다음 주 월요일이다.'],
        ['contract', 'n', '계약서', 'Both sides signed the *contract*.', '양측이 계약서에 서명했다.'],
        ['revenue', 'n', '수익, 매출', 'Company *revenue* rose by ten percent.', '회사 매출이 10퍼센트 올랐다.'],
        ['colleague', 'n', '동료', 'My *colleague* will cover for me.', '내 동료가 나 대신 맡아 줄 것이다.'],
        ['supervisor', 'n', '상사, 감독관', 'Ask your *supervisor* for approval.', '상사에게 승인을 요청하세요.'],
      ] },
      { name: '논리와 주장', words: [
        ['argue', 'v', '주장하다, 논쟁하다', 'Some experts *argue* that sleep is essential.', '일부 전문가들은 수면이 필수적이라고 주장한다.'],
        ['emphasize', 'v', '강조하다', 'Teachers often *emphasize* the importance of reading.', '교사들은 독서의 중요성을 자주 강조한다.'],
        ['contradict', 'v', '모순되다, 반박하다', 'His actions *contradict* his words.', '그의 행동은 그의 말과 모순된다.'],
        ['inevitable', 'adj', '불가피한', 'Change is *inevitable*.', '변화는 불가피하다.'],
        ['reluctant', 'adj', '꺼리는', 'He was *reluctant* to admit his mistake.', '그는 자신의 실수를 인정하기를 꺼렸다.'],
        ['controversial', 'adj', '논란이 많은', 'It is a *controversial* topic.', '그것은 논란이 많은 주제이다.'],
        ['justify', 'v', '정당화하다', 'Nothing can *justify* violence.', '어떤 것도 폭력을 정당화할 수 없다.'],
        ['implication', 'n', '함의, 영향', 'The *implication* of the study is serious.', '그 연구가 시사하는 바는 심각하다.'],
      ] },
      { name: '경제와 사회', words: [
        ['inflation', 'n', '물가 상승', 'High *inflation* hurts families.', '높은 물가 상승은 가계에 타격을 준다.'],
        ['budget', 'n', '예산', 'We need to stay within our *budget*.', '우리는 예산 안에서 지내야 한다.'],
        ['tax', 'n', '세금', 'You must pay income *tax*.', '소득세를 내야 한다.'],
        ['profit', 'n', '이익', 'The shop made a small *profit*.', '그 가게는 작은 이익을 냈다.'],
        ['unemployment', 'n', '실업', 'Youth *unemployment* is a serious problem.', '청년 실업은 심각한 문제이다.'],
        ['immigrant', 'n', '이민자', 'Each *immigrant* brings new ideas.', '이민자들은 저마다 새로운 아이디어를 가져온다.'],
        ['inequality', 'n', '불평등', 'Education can reduce *inequality*.', '교육은 불평등을 줄일 수 있다.'],
        ['subsidy', 'n', '보조금', 'Farmers receive a government *subsidy*.', '농부들은 정부 보조금을 받는다.'],
      ] },
      { name: '고난도 동사', words: [
        ['undermine', 'v', '약화시키다', 'Rumors can *undermine* trust.', '소문은 신뢰를 약화시킬 수 있다.'],
        ['enhance', 'v', '강화하다, 높이다', 'Music can *enhance* your memory.', '음악은 기억력을 높여 줄 수 있다.'],
        ['overcome', 'v', '극복하다', 'You can *overcome* any difficulty.', '너는 어떤 어려움도 극복할 수 있다.'],
        ['adapt', 'v', '적응하다', 'Animals *adapt* to their surroundings.', '동물들은 주변 환경에 적응한다.'],
        ['diminish', 'v', '줄어들다, 약해지다', 'Her fear began to *diminish*.', '그녀의 두려움이 줄어들기 시작했다.'],
        ['demonstrate', 'v', '입증하다, 보여주다', 'The experiment will *demonstrate* the idea.', '그 실험이 그 생각을 입증할 것이다.'],
        ['obtain', 'v', '얻다, 획득하다', 'You must *obtain* a permit first.', '먼저 허가증을 얻어야 한다.'],
        ['postpone', 'v', '연기하다', 'They had to *postpone* the game.', '그들은 경기를 연기해야 했다.'],
      ] },
    ],
  },
];

export const POS_LABEL = { n: '명사', v: '동사', adj: '형용사', adv: '부사' };

export const LEVELS = RAW.map((lv) => ({
  id: lv.id,
  name: lv.name,
  icon: lv.icon,
  desc: lv.desc,
  stages: lv.stages.map((st, si) => ({
    key: `${lv.id}-${si + 1}`,
    level: lv.id,
    index: si,
    name: st.name,
    words: st.words.map(([en, pos, ko, ex, exKo]) => ({
      id: en, en, pos, ko, ex, exKo, level: lv.id, stage: `${lv.id}-${si + 1}`,
    })),
  })),
}));

export const ALL_WORDS = LEVELS.flatMap((lv) => lv.stages.flatMap((st) => st.words));
export const WORD_BY_ID = new Map(ALL_WORDS.map((w) => [w.id, w]));
export const STAGE_BY_KEY = new Map(LEVELS.flatMap((lv) => lv.stages.map((st) => [st.key, st])));

export const levelWords = (levelId) => ALL_WORDS.filter((w) => w.level === levelId);
