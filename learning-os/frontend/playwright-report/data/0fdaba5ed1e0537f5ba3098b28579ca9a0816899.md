# Page snapshot

```yaml
- generic [ref=e4]:
  - generic [ref=e5]:
    - img [ref=e8]
    - heading "Welcome back" [level=1] [ref=e11]
    - paragraph [ref=e12]: Sign in to continue to Learning OS
  - generic [ref=e13]:
    - generic [ref=e14]:
      - generic [ref=e15]:
        - generic [ref=e16]: Email
        - generic [ref=e17]:
          - img [ref=e18]
          - textbox "you@example.com" [active] [ref=e21]
        - paragraph [ref=e22]: Invalid email address
      - generic [ref=e23]:
        - generic [ref=e24]: Password
        - generic [ref=e25]:
          - img [ref=e26]
          - textbox "Enter your password" [ref=e29]
        - paragraph [ref=e30]: Password is required
      - button "Sign In" [ref=e31]:
        - text: Sign In
        - img [ref=e32]
    - paragraph [ref=e35]:
      - text: Don't have an account?
      - link "Create account" [ref=e36] [cursor=pointer]:
        - /url: /register
  - paragraph [ref=e38]: Track • Learn • Grow
```