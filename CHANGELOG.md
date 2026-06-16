# Changelog

All notable changes to this project are documented here. This file is generated automatically by semantic-release from Conventional Commits.

# 1.0.0 (2026-06-16)

### Bug Fixes

- **api:** robust security/perf assertions + improve k6 perf infra ([578e780](https://github.com/Defused15/realworldapp-tests/commit/578e780c2d013ca47873a36be236efa033a297b2))
- **ci:** pin trivy-action to existing tag 0.35.0 (0.28.0 does not exist) ([d2b007c](https://github.com/Defused15/realworldapp-tests/commit/d2b007c5e4c8d170803d52ba0145bb9b51f0e7e4))
- **ci:** repair ZAP/Allure jobs + add flaky detection & quarantine ([d8336a6](https://github.com/Defused15/realworldapp-tests/commit/d8336a6339ac7de383d094d61da4c7005e5f9ffc)), closes [#1](https://github.com/Defused15/realworldapp-tests/issues/1)
- **ci:** run gitleaks via CLI to avoid the action's license/rate-limit gate ([c3f7c90](https://github.com/Defused15/realworldapp-tests/commit/c3f7c9030cf0645753d72500c674ab6b079e76dc))
- **ci:** run ZAP via docker + publish Allure to GitHub Pages ([76b9217](https://github.com/Defused15/realworldapp-tests/commit/76b9217c2f3d13094f4bcb7bf8d64e0cecc8a8d5))
- **observability:** k6 native histograms so Grafana latency panels populate ([8e20cac](https://github.com/Defused15/realworldapp-tests/commit/8e20caceb23676a1c9b532138f5ca1394e0fbe22))

### Features

- **qa:** QA Lead agent + executive report; perf-agent test-selection criteria ([fdcc5b5](https://github.com/Defused15/realworldapp-tests/commit/fdcc5b5e0295990f295f9538a696d93a0b5c807b)), closes [hi#traffic](https://github.com/hi/issues/traffic)
