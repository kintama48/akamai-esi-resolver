# ESI Resolver Worker

A Cloudflare Worker implementation for processing Edge Side Includes (ESI) tags in HTML responses. This worker provides server-side includes, conditional logic, loops, variable substitution, and custom functions.

## Finite State Machine Architecture

The ESI resolver follows a Finite State Machine (FSM) approach to process ESI tags systematically:

```
[Start] → [Parse HTML] → [ESI Tag?] → [Route to Handler] → [Process] → [Continue/Complete]
```

### State Flow:

1. **Parse HTML Stream**: Use HTMLRewriter to scan for ESI tags
2. **Tag Detection**: Identify ESI tag type and route to appropriate handler
3. **Tag Processing**: Execute tag-specific logic (include, assign, choose, etc.)
4. **State Management**: Handle variables, loops, conditions, and function calls
5. **Content Replacement**: Replace ESI tags with processed content or remove them
6. **Continue Processing**: Move to next content or complete

### Detailed FSM State Diagram

The following diagram shows the complete state machine with specific states for each ESI tag type based on real HTML template analysis:

```mermaid
graph TD
    S[START] --> A[Parse HTML Stream]
    
    A --> B{ESI Tag Detected?}
    B -->|No| Z[Continue HTML Processing]
    B -->|Yes| C[Identify Tag Type]
    
    C --> D{Tag Type Router}
    
    %% ASSIGN STATE BRANCH (State F)
    D -->|esi:assign| F[State F: ASSIGN]
    F --> F1[Parse name attribute]
    F1 --> F2[Parse value attribute]
    F2 --> F3[Process value expressions]
    F3 --> F4[Variable substitution]
    F4 --> F5[Store in ESI Context]
    F5 --> A
    
    %% CHOOSE STATE BRANCH (State G)
    D -->|esi:choose| G[State G: CHOOSE]
    G --> G1[Initialize condition stack]
    G1 --> G2[Process nested when/otherwise]
    G2 --> G3{When condition true?}
    G3 -->|Yes| G4[Execute when block]
    G3 -->|No| G5[Try next when]
    G4 --> A
    G5 --> G6{More when tags?}
    G6 -->|Yes| G3
    G6 -->|No| G7[Execute otherwise block]
    G7 --> A
    
    %% WHEN STATE BRANCH (State H)  
    D -->|esi:when| H[State H: WHEN]
    H --> H1[Parse test attribute]
    H1 --> H2[Evaluate condition]
    H2 --> H3[Variable substitution in test]
    H3 --> H4{Condition result?}
    H4 -->|True| H5[Process when content]
    H4 -->|False| H6[Skip content]
    H5 --> A
    H6 --> A
    
    %% FOREACH STATE BRANCH (State I)
    D -->|esi:foreach| I[State I: FOREACH]
    I --> I1[Parse collection attribute]
    I1 --> I2[Parse item attribute] 
    I2 --> I3[Evaluate collection expression]
    I3 --> I4[Initialize iterator]
    I4 --> I5{More items?}
    I5 -->|No| A
    I5 -->|Yes| I6[Set current item variable]
    I6 --> I7[Process loop body]
    I7 --> I8{Break flag set?}
    I8 -->|Yes| A
    I8 -->|No| I9[Next iteration]
    I9 --> I5
    
    %% BREAK STATE BRANCH (State J)
    D -->|esi:break| J[State J: BREAK]
    J --> J1[Set break flag in context]
    J1 --> J2[Exit current loop]
    J2 --> A
    
    %% VARS STATE BRANCH (State K)
    D -->|esi:vars| K[State K: VARS]
    K --> K1[Parse content]
    K1 --> K2[Variable substitution]
    K2 --> K3{Function call detected?}
    K3 -->|No| K4[Simple variable output]
    K3 -->|Yes| K5[Function execution]
    K4 --> A
    K5 --> K6[Parse function name]
    K6 --> K7[Parse function arguments]
    K7 --> K8{Built-in function?}
    K8 -->|Yes| K9[Execute built-in function]
    K8 -->|No| K10[Execute custom function]
    K9 --> K11[Process function result]
    K10 --> L[State L: Custom Function Call]
    K11 --> A
    
    %% FUNCTION STATE BRANCH (State M)
    D -->|esi:function| M[State M: FUNCTION_DEF]
    M --> M1[Parse name attribute]
    M1 --> M2[Store function definition]
    M2 --> M3[Process function body]
    M3 --> M4{Return encountered?}
    M4 -->|Yes| M5[Store return value]
    M4 -->|No| M6[Implicit null return]
    M5 --> A
    M6 --> A
    
    %% RETURN STATE BRANCH (State N)
    D -->|esi:return| N[State N: RETURN]
    N --> N1[Parse value attribute]
    N1 --> N2[Evaluate return expression]
    N2 --> N3[Variable substitution]
    N3 --> N4[Set return value in context]
    N4 --> N5[Exit function execution]
    N5 --> A
    
    %% CUSTOM FUNCTION CALL STATE (State L)
    L --> L1[Lookup function definition]
    L1 --> L2[Set ARGS variables]
    L2 --> L3[Execute function body]
    L3 --> L4[Process nested ESI tags]
    L4 --> L5{Return value set?}
    L5 -->|Yes| L6[Get return value]
    L5 -->|No| L7[Return null]
    L6 --> K11
    L7 --> K11
    
    %% OTHERWISE STATE BRANCH (State O)
    D -->|esi:otherwise| O[State O: OTHERWISE]
    O --> O1[Process otherwise content]
    O1 --> A
    
    %% COMPLETION
    Z --> P{End of HTML?}
    P -->|No| A
    P -->|Yes| Q[COMPLETE]

    %% STATE LABELS WITH BETTER TEXT CONTRAST
    classDef assignState fill:#e1f5fe,stroke:#01579b,stroke-width:2px,color:#000000
    classDef chooseState fill:#f3e5f5,stroke:#4a148c,stroke-width:2px,color:#000000
    classDef foreachState fill:#e8f5e8,stroke:#1b5e20,stroke-width:2px,color:#000000
    classDef functionState fill:#fff3e0,stroke:#e65100,stroke-width:2px,color:#000000
    classDef varsState fill:#fce4ec,stroke:#880e4f,stroke-width:2px,color:#000000
    classDef startEnd fill:#f5f5f5,stroke:#424242,stroke-width:3px,color:#000000
    
    class F,F1,F2,F3,F4,F5 assignState
    class G,G1,G2,G3,G4,G5,G6,G7 chooseState
    class H,H1,H2,H3,H4,H5,H6 chooseState
    class I,I1,I2,I3,I4,I5,I6,I7,I8,I9 foreachState
    class J,J1,J2 foreachState
    class M,M1,M2,M3,M4,M5,M6 functionState
    class N,N1,N2,N3,N4,N5 functionState
    class L,L1,L2,L3,L4,L5,L6,L7 functionState
    class K,K1,K2,K3,K4,K5,K6,K7,K8,K9,K10,K11 varsState
    class O,O1 chooseState
    class S,A,B,C,D,Z,P,Q startEnd
```

### State Breakdown

#### **State F: ASSIGN** (`esi:assign`)
Handles variable assignment with complex expression evaluation:
- **F1**: Parse name attribute 
- **F2**: Parse value attribute (handles complex expressions)
- **F3**: Process value expressions (string concatenation, function calls)
- **F4**: Variable substitution (`$(variable)`, `$(GEO{'country_code'})`)
- **F5**: Store in ESI Context variables map

**Real patterns from HTML templates:**
- Simple assignment: `<esi:assign name="isCrawler" value="false"/>`
- Complex expressions: `<esi:assign name="redirectEsi" value="'/' + $(setCountry) + '/' + $(setLanguage) + '.html'"/>`
- Function results: `<esi:assign name="acceptLanguage" value="$string_split($(item), ';')"/>`

#### **State G: CHOOSE** (`esi:choose`)
Manages conditional logic with nested when/otherwise blocks:
- **G1**: Initialize condition evaluation stack
- **G2-G7**: Process nested conditions with proper fallback logic
- Handles up to 4 levels of nesting found in real templates

**Real patterns:**
- Country/language validation with multiple nested conditions
- Crawler detection with boolean logic chains
- Cookie existence checks with complex branching

#### **State H: WHEN** (`esi:when`)
Evaluates individual conditional expressions:
- **H1-H4**: Parse and evaluate test conditions
- Supports complex expressions: `$(HTTP_USER_AGENT) matches $(crawler)`
- Boolean operations: `$(isSupported)`, `$exists($(variable))`

#### **State I: FOREACH** (`esi:foreach`)
Handles iteration over collections with break support:
- **I1-I4**: Parse collection and item attributes
- **I5-I9**: Main iteration loop with break flag detection
- **I8**: Critical break flag check (from nested `<esi:break/>` calls)

**Real patterns:**
- Crawler detection: `<esi:foreach collection="$string_split($(crawlerList),',')">`
- Language parsing: `<esi:foreach collection="$string_split($str($(HTTP_ACCEPT_LANGUAGE)), ',')">`

#### **State J: BREAK** (`esi:break`)
Provides early loop termination:
- **J1**: Set break flag in ESI context
- **J2**: Exit current foreach loop immediately

#### **State K: VARS** (`esi:vars`)
Executes variable substitution and function calls:
- **K1-K4**: Handle simple variable output
- **K5-K11**: Process function calls (both built-in and custom)

**Function execution patterns:**
- `$set_redirect()` calls for page redirects
- `$add_header()` calls for cookie/header management
- `$add_cachebusting_header()` for cache control

#### **State L: Custom Function Call**
Handles user-defined function execution:
- **L1-L7**: Function lookup, argument binding, and execution
- Supports recursive ESI processing within function bodies

#### **State M: FUNCTION_DEF** (`esi:function`)
Defines reusable custom functions:
- **M1-M6**: Parse function name and store definition
- Contains custom functions from templates:
  - `checkCountryLanguageExists`
  - `getPreferredLanguage` 
  - `countryLanguageIsSupported`
  - Cookie parsing functions

#### **State N: RETURN** (`esi:return`)
Handles function return values:
- **N1-N5**: Parse and evaluate return expressions
- Supports complex return values with variable substitution

#### **State O: OTHERWISE** (`esi:otherwise`)
Provides fallback logic for choose blocks:
- **O1**: Process default/fallback content when no when conditions match

## Supported ESI Tags

### Core Tags

#### `esi:include`
Include external HTML fragments.
```html
<esi:include src="/fragments/header.html" onerror="continue"/>
<esi:include src="/api/user/$(REQUEST_PATH)" />
```

**Features:**
- Variable substitution: `$(REQUEST_PATH)`, `$(QUERY_STRING{'param'})`, `$(RU)`, `$(LC)`
- Error handling with `onerror="continue"`
- Fragment host configuration
- Loop protection with headers

#### `esi:assign`
Assign values to variables.
```html
<esi:assign name="userType" value="guest"/>
<esi:assign name="redirectUrl" value="'/home/' + $(country) + '/' + $(language)"/>
```

#### `esi:vars`
Variable substitution and function execution.
```html
<esi:vars>$set_redirect($(redirectUrl))</esi:vars>
<esi:vars>$add_header('Set-Cookie', $(cookieValue))</esi:vars>
```

### Conditional Logic

#### `esi:choose`, `esi:when`, `esi:otherwise`
Conditional branching logic.
```html
<esi:choose>
  <esi:when test="$(isCrawler) == true">
    <esi:assign name="redirectUrl" value="'/crawler-page.html'"/>
  </esi:when>
  <esi:when test="$exists($(userPreference))">
    <esi:assign name="redirectUrl" value="$(userPreference)"/>
  </esi:when>
  <esi:otherwise>
    <esi:assign name="redirectUrl" value="'/default.html'"/>
  </esi:otherwise>
</esi:choose>
```

**Condition Types:**
- Existence checks: `$exists($(variable))`
- Equality: `$(var) == 'value'`
- Boolean evaluation: `$(flag) == true`

### Loops

#### `esi:foreach`
Iterate over collections with break support.
```html
<esi:foreach collection="$string_split($(crawlerList),',')" item="crawler">
  <esi:choose>
    <esi:when test="$(HTTP_USER_AGENT) matches $(crawler)">
      <esi:assign name="isCrawler" value="true"/>
      <esi:break/>
    </esi:when>
  </esi:choose>
</esi:foreach>
```

#### `esi:break`
Break out of loops.
```html
<esi:break/>
```

### Functions

#### `esi:function`
Define custom functions.
```html
<esi:function name="checkCountryLanguageExists">
  <esi:foreach item="language" collection="$(ARGS{0})">
    <esi:assign name="isSupported" value="($(language) == $(ARGS{1}))"/>
    <esi:choose>
      <esi:when test="$(isSupported)">
        <esi:break/>
      </esi:when>
    </esi:choose>
  </esi:foreach>
  <esi:return value="$(isSupported)"/>
</esi:function>
```

#### `esi:return`
Return values from functions.
```html
<esi:return value="$(computedValue)"/>
```

### Removed Tags
These tags are removed during processing (handled as delete):
- `esi:comment` - Comments
- `esi:try`, `esi:attempt`, `esi:except` - Error handling (not implemented)
- `esi:eval` - Expression evaluation (security concern)

## Built-in Variables

### Request Variables
- `$(REQUEST_PATH)` - Current request path
- `$(QUERY_STRING{'param'})` - Query parameter value
- `$(HTTP_HOST)` - Request host
- `$(HTTP_USER_AGENT)` - User agent string
- `$(HTTP_COOKIE{'name'})` - Cookie value
- `$(HTTP_ACCEPT_LANGUAGE)` - Accept-Language header

### Geolocation Variables
- `$(GEO{'country_code'})` - Country code from geo data
- `$(RU)` - Region/country from URL path (position 1)
- `$(LC)` - Language code from URL path (position 2)

### Custom Variables
Variables defined using `esi:assign` are available for substitution.

## Built-in Functions

### String Functions
- `$string_split(string, delimiter)` - Split string into array
- `$lower(string)` - Convert to lowercase
- `$str(value)` - Convert to string

### Utility Functions
- `$exists(variable)` - Check if variable exists
- `$html_encode(value)` - HTML encode value
- `$set_redirect(url)` - Set redirect response
- `$set_response_code(code)` - Set response status code
- `$add_header(name, value)` - Add response header
- `$add_cachebusting_header()` - Add cache busting headers

## Implementation Architecture

### Class Structure

#### `EdgeSideIncludesBehavior`
Main ESI processor class that orchestrates the ESI resolution pipeline.

#### `ESIContext`
Manages execution state including:
- Variables storage (`Map<string, any>`)
- Function definitions (`Map<string, ESIFunction>`)
- Break flags for loop control
- Return values for functions

#### ESI Handlers
Specialized handlers for each ESI tag type:
- `EsiIncludeHandler` - Processes includes and fragment fetching
- `EsiAssignHandler` - Variable assignment
- `EsiChooseHandler` - Conditional blocks
- `EsiWhenHandler` - Condition evaluation
- `EsiOtherwiseHandler` - Default fallback
- `EsiForeachHandler` - Loop processing
- `EsiVarsHandler` - Variable substitution
- `EsiFunctionHandler` - Function definition
- `EsiReturnHandler` - Return values
- `EsiBreakHandler` - Loop breaks

### Processing Pipeline

1. **Initial Check**: Scan response for ESI tags
2. **First Pass**: HTMLRewriter processes tags and collects include promises
3. **Include Resolution**: Fetch external fragments concurrently  
4. **Second Pass**: Replace include tags with fetched content
5. **Variable Processing**: Process vars, assigns, and conditional logic
6. **Final Output**: Return processed HTML response

### Variable Substitution

Variables are processed using regex patterns:
- `$(VARIABLE_NAME)` - Direct variable substitution
- `$(QUERY_STRING{'param'})` - Query parameter extraction
- `$(HTTP_COOKIE{'name'})` - Cookie value extraction
- `$(GEO{'field'})` - Geolocation data access

### Error Handling

- **Include Errors**: Handled via `onerror="continue"` attribute
- **Loop Protection**: Headers prevent infinite ESI loops
- **Graceful Degradation**: Worker returns original response on processing errors
- **Fragment Failures**: Failed includes return empty content or error placeholder

## Usage Examples

### Basic Include
```html
<esi:include src="/fragments/navigation.html"/>
```

### Conditional Redirect
```html
<esi:choose>
  <esi:when test="$exists($(countryMap{$(GEO{'country_code'})}))">
    <esi:vars>$set_redirect('https://'+$(HTTP_HOST)+$(countryMap{$(GEO{'country_code'})}))</esi:vars>
  </esi:when>
  <esi:otherwise>
    <esi:vars>$set_response_code(404)</esi:vars>
  </esi:otherwise>
</esi:choose>
```

### Loop with Break
```html
<esi:foreach collection="$string_split($(crawlerList),',')" item="crawler">
  <esi:when test="$(HTTP_USER_AGENT) matches $(crawler)">
    <esi:assign name="isCrawler" value="true"/>
    <esi:break/>
  </esi:when>
</esi:foreach>
```

### Cookie Management
```html
<esi:assign name="cookie" value="'session_id=' + $(sessionId) + '; path=/; secure;'"/>
<esi:vars>$add_header('Set-Cookie', $(cookie))</esi:vars>
```

## Configuration

The worker can be configured via:
- `enabled` - Enable/disable ESI processing
- `enableViaHttp` - Allow enabling via HTTP headers
- Edge-control headers: `dca=esi` (enable) or `dca=noop` (disable)

## Security Considerations

- Input sanitization for variable substitution
- Loop protection to prevent infinite recursion
- Fragment host validation
- Header injection prevention
- Eval functionality disabled for security

## Performance

- Concurrent fragment fetching
- Streaming HTML processing
- Minimal memory footprint
- Edge-optimized execution
- Caching integration

## Deployment

Deploy as a Cloudflare Worker:
```bash
npm run deploy
```

The worker automatically processes responses containing ESI tags and passes through other content unchanged.