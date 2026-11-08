# Contributing to EpoClaim

Thank you for your interest in contributing to **EpoClaim**! We welcome contributions that improve temporal fact-checking, atomic proposition verification, benchmark suites, and documentation.

---

## Code of Conduct

Please be respectful, collaborative, and constructive when participating in discussions, issue tracking, and pull requests.

---

## How Can I Contribute?

### 1. Reporting Bugs
- Ensure the bug was not already reported by searching existing GitHub Issues.
- Provide clear steps to reproduce the issue.
- Include Python / Node environment details, operating system, and error tracebacks.

### 2. Suggesting Enhancements
- Open an issue describing the proposed feature or enhancement.
- Explain the motivation, use cases, and how it aligns with EpoClaim's architecture (e.g., temporal verification, evidence ranking, claim extraction).

### 3. Pull Requests
- Fork the repository and create a descriptive branch:
  ```bash
  git checkout -b feature/your-feature-name
  ```
- Adhere to the project's coding standards and design principles:
  - **Deterministic Defaults**: Deterministic fallbacks must always remain functional when external LLMs or neural models are unconfigured.
  - **Temporal Integrity**: Respect EpoClaim's four clocks (`valid_time`, `publication_time`, `retrieval_time`, `transaction_time`).
  - **Safe Offline Verification**: Core benchmarks must run offline with zero required external API calls.
  - **Type Annotations**: Ensure Python code has complete type annotations and Pydantic schema validation.
  - **Test Coverage**: Write unit tests for all new functions, services, and edge cases.

---

## Development Setup

### Backend (Python / FastAPI)
1. Navigate to the backend directory and set up a virtual environment:
   ```bash
   cd backend
   python -m venv venv
   # On Windows:
   .\venv\Scripts\activate
   # On Linux / macOS:
   source venv/bin/activate
   ```
2. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
3. Run the automated test suite:
   ```bash
   python -m pytest backend/tests/ -v
   ```

### Frontend (React / TypeScript / Vite)
1. Navigate to the frontend directory:
   ```bash
   cd frontend
   npm install
   ```
2. Run the development server or build:
   ```bash
   npm run dev
   npm run build
   ```

---

## Commit Guidelines

- Write clear, concise commit messages following conventional commits:
  - `feat: ...` for new capabilities
  - `fix: ...` for bug fixes
  - `docs: ...` for documentation additions
  - `test: ...` for test suite additions
  - `refactor: ...` for code refactoring

---

## Attribution & Licenses
Any code adapted or imported from third-party research must be properly attributed in `THIRD_PARTY_NOTICES` and must comply with open-source licensing constraints.
