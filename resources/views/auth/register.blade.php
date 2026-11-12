
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Register - Mini CAD</title>
    @vite(['resources/css/app.css'])
</head>
<body class="auth-page">
    <main class="auth-card">
        <div class="auth-brand">
            <span class="auth-brand-mark" aria-hidden="true">⌑</span>
            <div><p class="auth-brand-title">Mini CAD Editor</p><p class="auth-brand-subtitle">Engineering workspace</p></div>
        </div>
        <h1>Create an account</h1>
        <p class="auth-intro">Register to start working on your projects.</p>

    <form method="POST" action="{{ route('register') }}">
        @csrf

        <div class="auth-field">
            <label for="name">Name</label>
            <input
                type="text"
                id="name"
                name="name"
                autocomplete="name"
                @error('name') aria-invalid="true" aria-describedby="name-error" @enderror
                value="{{ old('name') }}"
                required
            >
            @error('name')
                <p class="auth-error" id="name-error">{{ $message }}</p>
            @enderror
        </div>

        <div class="auth-field">
            <label for="email">Email</label>
            <input
                type="email"
                id="email"
                name="email"
                autocomplete="email"
                @error('email') aria-invalid="true" aria-describedby="email-error" @enderror
                value="{{ old('email') }}"
                required
            >
            @error('email')
                <p class="auth-error" id="email-error">{{ $message }}</p>
            @enderror
        </div>

        <div class="auth-field">
            <label for="password">Password</label>
            <input
                type="password"
                id="password"
                name="password"
                autocomplete="new-password"
                @error('password') aria-invalid="true" aria-describedby="password-error" @enderror
                minlength="8"
                required
            >
            @error('password')
                <p class="auth-error" id="password-error">{{ $message }}</p>
            @enderror
        </div>

        <div class="auth-field">
            <label for="password_confirmation">
                Confirm Password
            </label>
            <input
                type="password"
                id="password_confirmation"
                name="password_confirmation"
                autocomplete="new-password"
                minlength="8"
                required
            >
        </div>

        <button type="submit">Register</button>
    </form>

    <p class="auth-switch">
        Already have an account?
        <a href="{{ route('login') }}">Login</a>
    </p>
    </main>
</body>
</html>
