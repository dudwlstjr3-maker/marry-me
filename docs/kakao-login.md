# 카카오 로그인으로 둘이 함께 쓰기: 켜는 방법

앱 주소 https://dudwlstjr3-maker.github.io/marry-me/ 에서 신랑·신부가 각자 카카오로 로그인하면 같은 기록을 보고 함께 고칠 수 있어요.
로그인과 기록 보관은 무료 서비스 **Supabase**가 맡아요. 아래를 한 번만 하면 돼요(20~30분).

설정 전에는 앱이 지금처럼 이 기기에만 저장해요. claude.ai 아티팩트는 이 설정과 상관없이 원래 공유 방식을 그대로 써요.

## 1. Supabase 프로젝트 만들기
1. https://supabase.com 가입 → **New project**
   - Region: **Northeast Asia (Seoul)**
   - Database password는 따로 적어 두세요(앱에는 필요 없어요).
2. 왼쪽 **SQL Editor** → 새 쿼리에 저장소의 `supabase/setup.sql` 전체를 붙여 넣고 **Run**. 여러 번 실행해도 괜찮아요. 기존 프로젝트도 수첩 보존과 전환 기능을 사용하려면 갱신된 파일 전체를 한 번 실행하세요. SQL 적용 전에는 로그인과 기존 수첩 열기를 쓸 수 있고, 초대 참여는 업데이트 안내를 보여 줘요.
3. **Project Settings → API**에서 두 값을 복사해 Claude에게 주세요.
   - **Project URL** (예: `https://abcd1234.supabase.co`)
   - **anon public** 키 (`eyJ…`로 시작)
   - 이 두 값은 앱 안에 그대로 들어가는 공개용이라 알려 줘도 돼요. 누가 무엇을 볼 수 있는지는 1-2에서 넣은 규칙이 막아요.
   - **service_role 키는 절대 주지 마세요.** 모든 규칙을 무시하는 관리자 키예요.

## 2. 카카오 앱 만들기
1. https://developers.kakao.com → 로그인 → **내 애플리케이션 → 애플리케이션 추가하기** (앱 이름 예: 우리 결혼 준비)
2. **앱 설정 → 비즈니스**: **개인 개발자 비즈 앱**으로 전환해요.
   - Supabase가 카카오계정(이메일)을 요청하는데, 이 항목은 비즈 앱에서만 켤 수 있어요. 안 하면 로그인할 때 KOE205 오류가 나요.
3. **제품 설정 → 카카오 로그인**
   - 활성화 설정: **ON**
   - Redirect URI: `https://<1-3의 Project URL 주소>/auth/v1/callback` (예: `https://abcd1234.supabase.co/auth/v1/callback`)
4. **카카오 로그인 → 동의항목**
   - 닉네임: 필수 동의
   - 프로필 사진: 선택 동의
   - 카카오계정(이메일): 선택 동의
5. **카카오 로그인 → 보안**: Client Secret **코드 생성**, 활성화 상태 **사용함**
6. **앱 설정 → 앱 키**: **REST API 키** 복사
7. **앱 설정 → 플랫폼 → Web**: 사이트 도메인 `https://dudwlstjr3-maker.github.io` 추가

## 3. Supabase에 카카오 연결
1. **Authentication → Sign In / Providers → Kakao**: Enable
   - Client ID(REST API Key): 2-6의 REST API 키
   - Client Secret: 2-5의 코드
   - 이메일을 받지 않고 쓰려면 **Allow users without an email**도 켜세요.
2. **Authentication → URL Configuration**
   - Site URL: `https://dudwlstjr3-maker.github.io/marry-me/`
   - Redirect URLs에 추가: `https://dudwlstjr3-maker.github.io/marry-me/**`

카카오 REST API 키와 Client Secret은 Supabase에만 넣어요. Claude나 저장소에는 주지 마세요.

## 4. 쓰는 방법
1. 신랑(또는 신부)이 앱 → **공유 → 둘이 함께 쓰기 → 카카오 로그인**
   - 처음 로그인하면 그 휴대폰에 적어 둔 기록이 그대로 올라가요.
2. 같은 곳에서 **초대 링크 보내기** → 카카오톡으로 상대에게 보내요. 링크는 7일 동안 한 번 쓸 수 있어요.
3. 상대가 링크를 열고 **카카오 로그인** → 같은 기록이 보여요. 기존 수첩이 있으면 **지금 수첩 계속 쓰기**와 **초대받은 수첩으로 옮기기** 중 하나를 골라요.
   - 상대 휴대폰에 따로 적어 둔 기록은 그 휴대폰에만 남아요.
   - 수첩을 옮겨도 기존 멤버십과 기록이 남아요. **공유 → 둘이 함께 쓰기 → 다른 수첩 열기**에서 돌아갈 수 있어요. 기기마다 마지막으로 열었던 수첩을 기억해요.
   - 아직 보내지 못한 수정이 있으면 현재 수첩의 저장을 마친 뒤 옮겨요.
4. 이제 한쪽이 고치면 다른 쪽에 바로 나타나요. 둘이 동시에 다른 칸을 고쳐도 서로 지우지 않아요.

한 기록은 두 사람까지만 쓸 수 있어요. 로그아웃하면 그 기기에 따로 저장된 기록으로 돌아가요.
