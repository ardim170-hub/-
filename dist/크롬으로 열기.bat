@echo off
rem ===== 아르딤 취업지원 - 크롬으로 열기 =====
rem 회사 계정 크롬 프로필로 열려면 아래 PROFILE 에 프로필 폴더 이름을 넣으세요.
rem  (크롬 주소창에 chrome://version 입력 -> "프로필 경로" 맨 끝 폴더 이름. 예: Default, Profile 1)
set "PROFILE="

set "APP="
for %%F in ("%~dp0*.html") do set "APP=%%~fF"
if not defined APP (
  echo 같은 폴더에서 프로그램 파일(.html)을 찾지 못했습니다.
  pause
  exit /b
)

set "CHROME="
if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe" set "CHROME=%ProgramFiles%\Google\Chrome\Application\chrome.exe"
if not defined CHROME if exist "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" set "CHROME=%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
if not defined CHROME if exist "%LocalAppData%\Google\Chrome\Application\chrome.exe" set "CHROME=%LocalAppData%\Google\Chrome\Application\chrome.exe"
if not defined CHROME (
  echo 크롬(Chrome)을 찾지 못했습니다. 크롬을 설치한 뒤 다시 실행하세요.
  pause
  exit /b
)

if defined PROFILE (
  start "" "%CHROME%" --profile-directory="%PROFILE%" "%APP%"
) else (
  start "" "%CHROME%" "%APP%"
)
