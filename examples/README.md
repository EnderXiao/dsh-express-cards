# Examples

Paste any of these into a conversation that has the plugin enabled. They are written the way the
prompt rules ask the model to answer, so they render as cards instead of code blocks.

## Conclusion

````markdown
```expresscard
{"title":"The build is green","kind":"conclusion","body":"1327 tests passed, type check clean, bundle 1.2s."}
```
````

## Steps

````markdown
```expresscard
{"title":"Release checklist","kind":"steps","items":["Bump the version","Run the test suite","Tag the commit","Publish the release"]}
```
````

## Metrics with links

````markdown
```expresscard
{"title":"Local environment","kind":"metrics","metrics":[{"label":"Frontend","value":"http://127.0.0.1:10086"},{"label":"Backend","value":"http://127.0.0.1:3000"}]}
```
````

## Card group

````markdown
```expresscard
{"columns":2,"cards":[{"title":"Frontend","kind":"metrics","metrics":[{"label":"Port","value":"10086"}]},{"title":"Backend","kind":"metrics","metrics":[{"label":"Port","value":"3000"}]}]}
```
````

## Invalid JSON (falls back to a code block with a notice)

````markdown
```expresscard
{"title": this is not valid JSON
```
````
