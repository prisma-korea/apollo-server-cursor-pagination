# Prisma relay pagination implementation
This repo is to show an example someone who wants to implement relay pagination on your project.

## specification
- [prisma](https://www.prisma.io/)
- [graphql-relay](https://github.com/graphql/graphql-relay-js)

## Description

`relayFunction` returns `Connection` type which is needed for pagination, so you can use this function directly on your resolver.

```typescript
const resolver: Resolver = {
  Query: {
    todos: async (_, args, {prisma}) => {
      return await relayPagination({
        prisma,
        args,
        type: 'todo',
        options: {
          orderBy: {id: 'desc'}
        }
      })
    }
  }
}

```

### argument description
1. prisma : `relayPagination` function uses prisma client internally, you should pass prisma client instance.

2. args: `args` is for cursor pagination input like `first`, `after`. Since  this function is only support forward pagination, you just need to pass 2 args. `first` is an amount of rows you want to query at first. `after` is a cursor string that returns in `edge`. 

3. type: `type` is prisma data model you want to. you should pass valid model name to type.

4. options: `options` is for additional arguments for prisma `findMany` method.





## Limitation
This function is only support forward pagination. If you want to know more about this, please check specification [here](https://relay.dev/graphql/connections.htm).
